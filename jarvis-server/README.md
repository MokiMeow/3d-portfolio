# JARVIS server

JARVIS's mind and voice, served, so visitors to the lab download nothing.

- **Mind:** Qwen3.5 2B (Q4_K_M GGUF) on llama.cpp, OpenAI-compatible, streaming.
- **Voice:** Kokoro-82M with JARVIS's original blended voices (Sterling by default), 24 kHz WAV per sentence.
- **Front door:** `server.mjs` checks a shared key, speaks, and forwards chat to the mind. Caddy adds HTTPS.

The website never exposes this server to browsers. Its Nuxt routes (`/api/jarvis`, `/api/jarvis-voice`) call it
with the key, which lives only in Vercel's environment.

Measured on a laptop limited to 2 CPU threads: first word in about 0.3 s, about 19 tokens a second, and a
7-second Sterling sentence synthesised in about 1.4 s.

## Deploy on Oracle Cloud Always Free (ARM, no monthly cost)

1. Create an Oracle Cloud Free Tier account (a card is needed for identity checks; Always Free resources are not billed).
2. Create a VM: **Ubuntu 24.04, shape VM.Standard.A1.Flex, 4 OCPU, 24 GB RAM** (all within Always Free).
   In its subnet's security list, allow inbound TCP **80 and 443**; keep 22 limited to your own IP.
3. On the VM:
   ```bash
   sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
   sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT && sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
   sudo netfilter-persistent save 2>/dev/null || true
   git clone https://github.com/MokiMeow/3d-portfolio.git && cd 3d-portfolio/jarvis-server
   cp .env.example .env
   # JARVIS_SERVER_KEY: openssl rand -hex 32
   # DOMAIN: your hostname, or the VM's public IP as 1-2-3-4.sslip.io
   nano .env
   sudo docker compose up -d --build
   ```
   The first start downloads the model (1.3 GB) and Kokoro (330 MB); give it a few minutes.
4. Check it: `curl https://YOUR_DOMAIN/health` should say `"voice": true`.

## Connect the website (Vercel → Project → Settings → Environment Variables)

| Variable | Value |
|---|---|
| `NUXT_JARVIS_URL` | `https://YOUR_DOMAIN/v1` |
| `NUXT_JARVIS_KEY` | the same `JARVIS_SERVER_KEY` |
| `NUXT_JARVIS_MODEL` | `qwen3.5-2b` |
| `NUXT_JARVIS_NAME` | `Qwen3.5 2B` |
| `NUXT_JARVIS_NO_THINK` | `1` |
| `NUXT_JARVIS_VOICE_URL` | `https://YOUR_DOMAIN/v1/audio/speech` |

Redeploy. JARVIS then comes online at once for every visitor, speaking as Sterling, with nothing downloaded.

## Mind only, from a managed service

Any OpenAI-compatible provider works for the mind without this server, e.g. Cloudflare Workers AI
(free daily allowance): `NUXT_JARVIS_URL=https://api.cloudflare.com/client/v4/accounts/ACCOUNT_ID/ai/v1`,
`NUXT_JARVIS_KEY=<Workers AI token>`, `NUXT_JARVIS_MODEL=@cf/meta/llama-3.2-3b-instruct`. Without
`NUXT_JARVIS_VOICE_URL` the voice falls back to the in-browser one.

## Run locally

```bash
npm install
JARVIS_SERVER_KEY=dev-key LLM_URL=http://127.0.0.1:8080 node server.mjs
```
with `llama-server -hf unsloth/Qwen3.5-2B-GGUF:Q4_K_M --port 8080 --jinja` running beside it.
