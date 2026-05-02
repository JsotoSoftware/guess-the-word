# Docker deployment

This project can run with Docker Compose behind a Caddy container connected to the external network `caddy_default`.

## Files added
- `docker-compose.yml`
- `Dockerfile.server`
- `Dockerfile.web`
- `docker/nginx.web.conf.template`
- `.env.docker.example`

## Ports used inside Docker
- Web: `2027`
- Server/API + Socket.IO: `2028`

These ports are exposed only to the Docker network for Caddy to reverse proxy.

## 1. Create env file
Copy `.env.docker.example` to `.env` in the repository root and replace the values.

Example:

```env
CLIENT_URL=https://game.example.com
VITE_API_URL=https://api.example.com
VITE_SOCKET_URL=https://api.example.com
POSTGRES_DB=guess_the_word
POSTGRES_USER=guess_user
POSTGRES_PASSWORD=change_me
```

## 2. Start containers

```bash
docker compose build
docker compose up -d
```

## 3. Import more words
If your words file exists on the host in the repository, you can copy it into the server container or mount it temporarily.

Example using `docker cp`:

```bash
docker cp ./words.txt guess-the-word-server:/tmp/words.txt
docker compose exec server npm run words:import --workspace @guess-the-word/server -- /tmp/words.txt --language es
```

## 4. Caddy reverse proxy
Example Caddyfile entries:

```caddy
game.example.com {
    reverse_proxy guess-the-word-web:2027
}

api.example.com {
    reverse_proxy guess-the-word-server:2028
}
```

Because both services are on `caddy_default`, Caddy can reach them by container name.

## Notes
- The frontend build bakes in `VITE_API_URL` and `VITE_SOCKET_URL`, so rebuild the web image if you change domains.
- The backend CORS uses `CLIENT_URL`, so it must match the public frontend domain exactly.
- The server container automatically runs database migrations on start.
