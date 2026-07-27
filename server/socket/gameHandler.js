const axios = require('axios');
const supabase = require('../lib/supabase');
const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}`;

module.exports = function(io) {
  // rooms[session_code] = { players: [{ socket_id, user_id, username, role }], ... }
  const rooms = {};

  io.on('connection', (socket) => {
    // 'host' just joins the room to receive events — not added to the player list.
    socket.on('session:join', ({ session_code, user_id, username, role: clientRole }) => {
      socket.join(session_code);

      if (!rooms[session_code]) {
        rooms[session_code] = { players: [], matchStarted: false };
      }
      const room = rooms[session_code];

      // Reconnecting player — same user_id already in the room
      const existingPlayer = room.players.find(p => p.user_id === user_id);
      if (existingPlayer) {
        // Update their socket_id to the new socket
        existingPlayer.socket_id = socket.id;
        // Confirm back to this socket only — do not broadcast to whole room
        socket.emit('session:player_joined', {
          user_id,
          username,
          role: existingPlayer.role,
        });
        return;
      }

      // If client explicitly says host, do not add to players array
      if (clientRole === 'host') {
        socket.emit('session:player_joined', { user_id, username, role: 'host' });
        return;
      }

      let role = 'host';
      if (room.players.length === 0) role = 'player1';
      else if (room.players.length === 1) role = 'player2';

      if (role === 'player1' || role === 'player2') {
        room.players.push({
          socket_id: socket.id,
          user_id,
          username,
          role,
        });
      }

      // Broadcast to whole room so lobby updates
      io.to(session_code).emit('session:player_joined', { user_id, username, role });
    });

    // Remove the player from rooms if they disconnect before the match starts.
    socket.on('disconnect', () => {
      for (const code in rooms) {
        const room = rooms[code];
        // Only remove from players if match has NOT started yet
        if (!room.matchStarted) {
          room.players = room.players.filter(p => p.socket_id !== socket.id);
        }
        // If match is in progress, keep the player in the array
        // They will reconnect and update their socket_id via session:join
      }
    });

    socket.on('session:ready', async ({ session_code, session_id, player1_id, player2_id }) => {
      console.log(`[gameHandler] EVENT session:ready -> code: ${session_code}, id: ${session_id}, p1: ${player1_id}, p2: ${player2_id}`);
      const room = rooms[session_code];
      if (!room) {
        console.error(`[gameHandler] Room ${session_code} not found on session:ready`);
        return;
      }
      room.matchStarted = true;

      // Initialize room state for match
      room.match_id = null;
      room.player1_hp = 100;
      room.player2_hp = 100;
      room.current_question = null;
      room.round_number = 0;
      room.round_start_time = null;
      room.answers = {};
      if (room.timer) {
        clearTimeout(room.timer);
        room.timer = null;
      }

      try {
        console.log(`[gameHandler] Calling POST ${BASE_URL}/api/matches internally...`);
        const matchRes = await axios.post(`${BASE_URL}/api/matches`, {
          session_id,
          player1_id,
          player2_id,
        });
        room.match_id = matchRes.data.match_id;
        console.log(`[gameHandler] Match created internally -> match_id: ${room.match_id}`);
      } catch (err) {
        console.error('[gameHandler] Error calling POST /api/matches:', err.message || err);
      }

      try {
        console.log(`[gameHandler] Updating session status to 'active'...`);
        try {
          await axios.patch(`${BASE_URL}/api/sessions/${session_id}`, { status: 'active' });
        } catch (axiosErr) {
          await supabase.from('sessions').update({ status: 'active' }).eq('session_id', session_id);
        }
        console.log(`[gameHandler] Session status updated to 'active'`);
      } catch (err) {
        console.error('[gameHandler] Error updating session status:', err.message || err);
      }

      await startNewRound(session_code, io);
    });

    socket.on('round:key_strike', async (data) => {
      console.log('round:key_strike received:', JSON.stringify(data));
      const { session_code, player } = data || {};
      const keyToOption = {
        'a': 1, 's': 2, 'd': 3,
        'j': 1, 'k': 2, 'l': 3,
      };
      const key = (data?.key || '').toLowerCase();
      const optionIndex = keyToOption[key];
      console.log(`Mapped key '${key}' to option index: ${optionIndex}`);
      if (optionIndex === undefined || optionIndex === null) {
        console.log('No mapping found for key — treating as no answer');
        return;
      }

      console.log(`[gameHandler] EVENT round:key_strike -> code: ${session_code}, player: ${player}, key: ${key}`);
      const room = rooms[session_code];
      if (!room || !room.current_question) {
        console.warn(`[gameHandler] Ignoring key_strike: room or current_question missing for ${session_code}`);
        return;
      }

      if (room.answers[player]) {
        console.log(`[gameHandler] Ignoring key_strike: ${player} already answered in round ${room.round_number}`);
        return;
      }

      const ms = room.round_start_time ? Date.now() - room.round_start_time : 0;
      room.answers[player] = {
        option_index: optionIndex,
        key: key,
        ms,
      };
      console.log(`[gameHandler] Recorded answer for ${player} -> option_index: ${optionIndex}, ms: ${ms}`);

      if (room.answers.player1 && room.answers.player2) {
        console.log(`[gameHandler] Both players answered in room ${session_code}! Resolving round...`);
        if (room.timer) {
          clearTimeout(room.timer);
          room.timer = null;
        }
        await resolveRound(session_code, io);
      }
    });
  });

  async function startNewRound(session_code, io) {
    const room = rooms[session_code];
    if (!room) return;

    room.round_number += 1;
    console.log(`[gameHandler] startNewRound -> round_number: ${room.round_number} for room ${session_code}`);

    room.answers = {};
    if (room.timer) {
      clearTimeout(room.timer);
      room.timer = null;
    }

    let difficulty = 'easy';
    if (room.round_number >= 4 && room.round_number <= 6) {
      difficulty = 'medium';
    } else if (room.round_number >= 7) {
      difficulty = 'hard';
    }

    try {
      console.log(`[gameHandler] Fetching question from ${BASE_URL}/api/questions/random?difficulty=${difficulty}...`);
      const qRes = await axios.get(`${BASE_URL}/api/questions/random?difficulty=${difficulty}`, {
        headers: { 'x-internal-call': 'true' },
      });
      const qData = qRes.data;

      room.current_question = {
        question_id: qData.question_id,
        correct_option_index: qData.correct_option_index,
        difficulty: qData.difficulty || difficulty,
        explanation: qData.explanation || '',
      };
      console.log(`[gameHandler] Question stored -> question_id: ${room.current_question.question_id}, correct_option_index: ${room.current_question.correct_option_index}`);

      room.round_start_time = Date.now();

      const emitPayload = {
        round_number: room.round_number,
        code_snippet: qData.code_snippet,
        option_1: qData.option_1,
        option_2: qData.option_2,
        option_3: qData.option_3,
        difficulty: room.current_question.difficulty,
        timestamp_ms: room.round_start_time,
      };

      console.log(`[gameHandler] Emitting 'round:question' to room ${session_code}`);
      io.to(session_code).emit('round:question', emitPayload);

      room.timer = setTimeout(() => {
        console.log(`[gameHandler] 15 seconds timer expired for room ${session_code}, resolving round...`);
        resolveRound(session_code, io);
      }, 15000);
    } catch (err) {
      console.error(`[gameHandler] Error in startNewRound:`, err.message || err);
    }
  }

  async function resolveRound(session_code, io) {
    const room = rooms[session_code];
    if (!room || !room.current_question) return;

    if (room.timer) {
      clearTimeout(room.timer);
      room.timer = null;
    }

    console.log(`[gameHandler] resolveRound -> room: ${session_code}, round: ${room.round_number}`);

    const { question_id, correct_option_index, difficulty, explanation } = room.current_question;
    const ans1 = room.answers.player1 || null;
    const ans2 = room.answers.player2 || null;

    const p1Correct = ans1 && ans1.option_index === correct_option_index;
    const p2Correct = ans2 && ans2.option_index === correct_option_index;

    let winnerRole = null;
    if (p1Correct && !p2Correct) {
      winnerRole = 'player1';
    } else if (!p1Correct && p2Correct) {
      winnerRole = 'player2';
    } else if (p1Correct && p2Correct) {
      if (ans1.ms <= ans2.ms) {
        winnerRole = 'player1';
      } else {
        winnerRole = 'player2';
      }
    } else {
      winnerRole = null;
    }

    console.log(`[gameHandler] Round winner role determined -> ${winnerRole || 'DRAW'}`);

    let damage = 0;
    if (winnerRole !== null) {
      if (difficulty === 'easy') damage = 10;
      else if (difficulty === 'medium') damage = 20;
      else if (difficulty === 'hard') damage = 30;
      else damage = 10;
    }

    if (winnerRole === 'player1') {
      room.player2_hp = Math.max(0, room.player2_hp - damage);
    } else if (winnerRole === 'player2') {
      room.player1_hp = Math.max(0, room.player1_hp - damage);
    }
    console.log(`[gameHandler] HP after round -> p1: ${room.player1_hp}, p2: ${room.player2_hp}, damage_dealt: ${damage}`);

    let round_winner_id = null;
    if (winnerRole) {
      const winnerPlayer = room.players.find(p => p.role === winnerRole);
      if (winnerPlayer) {
        round_winner_id = winnerPlayer.user_id;
      }
    }

    if (room.match_id) {
      try {
        console.log(`[gameHandler] Calling POST ${BASE_URL}/api/matches/${room.match_id}/rounds internally...`);
        await axios.post(`${BASE_URL}/api/matches/${room.match_id}/rounds`, {
          question_id,
          round_number: room.round_number,
          player1_key_struck: ans1 ? ans1.key : null,
          player2_key_struck: ans2 ? ans2.key : null,
          player1_response_ms: ans1 ? ans1.ms : null,
          player2_response_ms: ans2 ? ans2.ms : null,
          round_winner_id,
          damage_dealt: damage,
        });
        console.log(`[gameHandler] Match round recorded in database.`);
      } catch (err) {
        console.error(`[gameHandler] Error calling POST /api/matches/:id/rounds:`, err.message || err);
      }
    } else {
      console.warn(`[gameHandler] Skipping POST /api/matches/:id/rounds because match_id is null`);
    }

    const resultPayload = {
      round_winner_id,
      correct_option_index,
      player1_answer_index: ans1 ? ans1.option_index : null,
      player2_answer_index: ans2 ? ans2.option_index : null,
      player1_key: ans1 ? ans1.key : null,
      player2_key: ans2 ? ans2.key : null,
      player1_response_ms: ans1 ? ans1.ms : null,
      player2_response_ms: ans2 ? ans2.ms : null,
      damage_dealt: damage,
      player1_hp: room.player1_hp,
      player2_hp: room.player2_hp,
      explanation: explanation || '',
    };

    console.log(`[gameHandler] Emitting 'round:result' to room ${session_code}`, resultPayload);
    io.to(session_code).emit('round:result', resultPayload);

    if (room.player1_hp <= 0 || room.player2_hp <= 0) {
      console.log(`[gameHandler] Match over condition reached in room ${session_code}! Calling endMatch...`);
      await endMatch(session_code, io);
    } else {
      console.log(`[gameHandler] Waiting 5 seconds before starting next round in room ${session_code}...`);
      setTimeout(() => {
        startNewRound(session_code, io);
      }, 5000);
    }
  }

  async function endMatch(session_code, io) {
    const room = rooms[session_code];
    if (!room) return;

    if (room.timer) {
      clearTimeout(room.timer);
      room.timer = null;
    }

    console.log(`[gameHandler] endMatch -> room: ${session_code}`);

    let winnerRole = null;
    if (room.player2_hp <= 0 && room.player1_hp > 0) {
      winnerRole = 'player1';
    } else if (room.player1_hp <= 0 && room.player2_hp > 0) {
      winnerRole = 'player2';
    } else if (room.player1_hp <= 0 && room.player2_hp <= 0) {
      winnerRole = room.player1_hp >= room.player2_hp ? 'player1' : 'player2';
    } else {
      winnerRole = 'player1';
    }

    const winnerPlayer = room.players.find(p => p.role === winnerRole);
    const winner_id = winnerPlayer ? winnerPlayer.user_id : null;
    const winner_username = winnerPlayer ? winnerPlayer.username : null;
    console.log(`[gameHandler] Match winner determined -> role: ${winnerRole}, user_id: ${winner_id}, username: ${winner_username}`);

    if (room.match_id) {
      try {
        console.log(`[gameHandler] Calling PATCH ${BASE_URL}/api/matches/${room.match_id} internally...`);
        await axios.patch(`${BASE_URL}/api/matches/${room.match_id}`, {
          winner_id,
          player1_final_hp: room.player1_hp,
          player2_final_hp: room.player2_hp,
        });
        console.log(`[gameHandler] Match updated in database with winner_id: ${winner_id}`);
      } catch (err) {
        console.error(`[gameHandler] Error calling PATCH /api/matches/:id:`, err.message || err);
      }
    }

    try {
      console.log(`[gameHandler] Updating session status to 'ended' in database for code: ${session_code}...`);
      await supabase
        .from('sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('session_code', session_code);
      console.log(`[gameHandler] Session status updated to 'ended' in database.`);
    } catch (err) {
      console.error(`[gameHandler] Error updating session to ended:`, err.message || err);
    }

    const matchEndPayload = {
      winner_id,
      winner_username,
      player1_final_hp: room.player1_hp,
      player2_final_hp: room.player2_hp,
    };
    console.log(`[gameHandler] Emitting 'match:end' to room ${session_code}`, matchEndPayload);
    io.to(session_code).emit('match:end', matchEndPayload);

    delete rooms[session_code];
    console.log(`[gameHandler] Room ${session_code} deleted from memory.`);
  }
};

