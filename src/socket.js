import { io } from 'socket.io-client';

const resolveSocketUrl = () => {
  const envUrl = String(import.meta.env.VITE_SOCKET_URL || '').trim();
  if (envUrl) return envUrl;
  if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return 'http://localhost:3000';
  }
  return window.location.origin;
};

export function crearSocket() {
  return io(resolveSocketUrl(), { transports: ['websocket', 'polling'] });
}
