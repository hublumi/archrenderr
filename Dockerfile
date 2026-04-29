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

RUN SUPABASE_URL="https://frtjtiatpjrxyvnsvplb.supabase.co" SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZydGp0aWF0cGpyeHl2bnN2cGxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNDg5MDMsImV4cCI6MjA5MjYyNDkwM30.-N-wPnceH7vy-lLlG0V7C0mzva_RTm9tHm7XKSYeA9c" NEXT_PUBLIC_SUPABASE_URL="https://frtjtiatpjrxyvnsvplb.supabase.co" NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZydGp0aWF0cGpyeHl2bnN2cGxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNDg5MDMsImV4cCI6MjA5MjYyNDkwM30.-N-wPnceH7vy-lLlG0V7C0mzva_RTm9tHm7XKSYeA9c" npm run build

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
