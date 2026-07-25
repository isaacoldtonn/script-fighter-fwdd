module.exports = function(io) {
  // In-memory store: rooms[session_code] = { players: [] }
  // Each player: { socket_id, user_id, username, role: 'player1'|'player2' }
  const rooms = {};

  io.on('connection', (socket) => {
    // EVENT: session:join
    // Payload: { session_code, user_id, username, role }
    // 'host' role just joins the room to receive events — do not add to player list.
    // 'player1' or 'player2' role: add to rooms[session_code].players[]
    // After joining, broadcast 'session:player_joined' to the whole room:
    //   Payload: { user_id, username, role }
    // If the room doesn't exist yet, create it: rooms[session_code] = { players: [] }

    socket.on('session:join', ({ session_code, user_id, username, role }) => {
      console.log(`[gameHandler] session:join received -> session_code: ${session_code}, user_id: ${user_id}, role: ${role}`);
      socket.join(session_code);
      if (!rooms[session_code]) rooms[session_code] = { players: [] };
      if (role === 'player1' || role === 'player2') {
        rooms[session_code].players.push({ socket_id: socket.id, user_id, username, role });
      }
      console.log(`[gameHandler] emitting session:player_joined to room: ${session_code} with payload:`, { user_id, username, role });
      io.to(session_code).emit('session:player_joined', { user_id, username, role });
    });

    // EVENT: disconnect
    // Remove the player from rooms if they disconnect before the match starts.
    socket.on('disconnect', () => {
      for (const code in rooms) {
        rooms[code].players = rooms[code].players.filter(p => p.socket_id !== socket.id);
      }
    });

    // Leave all other events (round:question, round:key_strike, etc.) for Slice 4.
  });
};
