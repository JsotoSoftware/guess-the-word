interface WebEnv {
  apiUrl: string
  socketUrl: string
}

export const env: WebEnv = {
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  socketUrl: import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3000',
}
