const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const authRouter = require('./routes/auth');
const sessionsRouter = require('./routes/sessions');
const matchesRouter = require('./routes/matches');
const questionsRouter = require('./routes/questions');

const app = express();

let frontendUrl = process.env.FRONTEND_URL || '';
if (frontendUrl && !frontendUrl.startsWith('http://') && !frontendUrl.startsWith('https://')) {
  frontendUrl = `https://${frontendUrl}`;
}

app.use(cors({
  origin: frontendUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
}));

app.options('*', cors({
  origin: frontendUrl,
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

// Mount routers
app.use('/api/auth', authRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/matches', matchesRouter);
app.use('/api/questions', questionsRouter);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: frontendUrl,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

require('./socket/gameHandler')(io);

const PORT = process.env.PORT || 5000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
