import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    let apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    if (apiUrl && !apiUrl.startsWith('http://') && !apiUrl.startsWith('https://') && !apiUrl.startsWith('/')) {
      apiUrl = `https://${apiUrl}`;
    }
    socket = io(apiUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
