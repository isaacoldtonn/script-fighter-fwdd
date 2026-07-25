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

    socket.on('session:join', ({ session_code, user_id, username, role: clientRole }) => {
      socket.join(session_code);
      if (!rooms[session_code]) rooms[session_code] = { players: [] };

      const room = rooms[session_code];
      let role = 'host';

      if (clientRole === 'host') {
        role = 'host';
      } else if (room.players.length === 0) {
        role = 'player1';
      } else if (room.players.length === 1) {
        role = 'player2';
      }

      if (role === 'player1' || role === 'player2') {
        room.players.push({ socket_id: socket.id, user_id, username, role });
      }

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
