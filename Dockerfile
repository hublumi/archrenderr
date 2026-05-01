# Etapa de dependências
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Etapa de build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variáveis de ambiente durante o build (opcional, melhor via painel do Cloud Run)
ENV NEXT_TELEMETRY_DISABLED 1

RUN SUPABASE_URL="https://agvililkxboyephvybov.supabase.co" SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFndmlsaWxreGJveWVwaHZ5Ym92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NDQxMzUsImV4cCI6MjA5MzIyMDEzNX0.8fdez433HQ9toRUuSHSh3anDu3Fx6ygum055z5FwhUA" NEXT_PUBLIC_SUPABASE_URL="https://agvililkxboyephvybov.supabase.co" NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFndmlsaWxreGJveWVwaHZ5Ym92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NDQxMzUsImV4cCI6MjA5MzIyMDEzNX0.8fdez433HQ9toRUuSHSh3anDu3Fx6ygum055z5FwhUA" npm run build

# Etapa de execução
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copiar arquivos necessários do build standalone
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs


ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
