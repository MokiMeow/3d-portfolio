# JARVIS's voice and front door. The mind (llama.cpp) runs beside it; see docker-compose.yml.
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server.mjs ./
COPY voices ./voices
# Kokoro's weights (about 330 MB) download from Hugging Face on first start and are kept in this volume.
ENV HF_HOME=/cache
VOLUME /cache
EXPOSE 8787
CMD ["node", "server.mjs"]
