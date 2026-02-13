# DOCUMENTAÇÃO TÉCNICA - REUNE.IO
## Sistema de Escritório Virtual

**Versão**: 2.0
**Domínio**: escritorio.insightsmeet.com.br
**Repositório**: https://github.com/yagogavilan/escritorio-virtual-2

---

## 1. STACK TECNOLÓGICO

### Backend
- **Linguagem**: TypeScript 5.7.2
- **Runtime**: Node.js 20
- **Framework**: Fastify 4.28.1
- **ORM**: Prisma 5.22.0
- **Banco de Dados**: PostgreSQL 15+
- **Real-time**: Socket.io 4.8.1
- **Autenticação**: JWT (@fastify/jwt 9.0.2)
- **Segurança**: bcryptjs 2.4.3
- **Validação**: Zod 3.23.8

### Frontend
- **Linguagem**: TypeScript 5.6.2
- **Framework**: React 19.2.3
- **Build Tool**: Vite 6.2.0
- **HTTP Client**: Axios 1.7.8
- **WebSocket**: Socket.io Client 4.8.1
- **UI**: Lucide React 0.562.0 (ícones)
- **Charts**: Recharts 3.6.0
- **Styling**: Tailwind CSS

### Infraestrutura
- **Containerização**: Docker + Docker Compose
- **Web Server**: Nginx (alpine)
- **Reverse Proxy**: Traefik
- **SSL**: Let's Encrypt (automático)

---

## 2. ARQUITETURA

### Estrutura Backend
```
/backend
├── src/
│   ├── index.ts              # Entry point
│   ├── routes/               # APIs REST
│   │   ├── auth.ts          # Autenticação
│   │   ├── users.ts         # Usuários
│   │   ├── office.ts        # Escritórios
│   │   ├── sectors.ts       # Setores
│   │   ├── rooms.ts         # Salas
│   │   ├── invites.ts       # Convites
│   │   ├── channels.ts      # Chat
│   │   ├── tasks.ts         # Tarefas
│   │   ├── announcements.ts # Comunicados
│   │   ├── upload.ts        # Uploads
│   │   ├── billing.ts       # Faturamento
│   │   └── analytics.ts     # Analytics
│   └── websocket/
│       └── index.ts         # Socket.io
└── prisma/
    └── schema.prisma        # Schema DB
```

### Estrutura Frontend
```
/frontend
├── src/
│   ├── App.tsx                    # Root component
│   ├── types.ts                   # Interfaces TypeScript
│   └── components/
│       ├── AdminDashboard.tsx     # Painel admin
│       ├── OfficeView.tsx         # View do escritório
│       ├── VideoModal.tsx         # Videochamadas
│       └── ToastNotification.tsx  # Notificações
```

---

## 3. FUNCIONALIDADES DO SISTEMA

### 3.1 Autenticação e Usuários
- Login com email/senha (JWT)
- Login de visitante com código temporário
- Roles: `master`, `admin`, `user`, `visitor`
- Status: `online`, `busy`, `away`, `offline`, `in_meeting`
- Perfil: nome, avatar, cargo, setor
- Mensagem de status personalizada
- Impersonação (master pode se passar por outro usuário)
- Alteração de senha

### 3.2 Multi-Tenant (Escritórios)
- Múltiplos escritórios isolados
- Configuração por escritório:
  - Nome e logo
  - Cor primária (branding)
  - Horário de funcionamento (início/fim)
  - Integrações: Google Chat, Rocket.Chat
- Master gerencia todos os escritórios
- Admin gerencia apenas seu escritório

### 3.3 Estrutura Organizacional
**Setores/Departamentos**:
- Organização de usuários por setor
- Cor customizada por setor
- Filtros e analytics por setor

**Salas de Reunião**:
- Salas fixas (permanentes)
- Capacidade máxima configurável
- Salas restritas (acesso controlado)
- Cor, ícone e background customizados
- Owner da sala
- Entrar/sair de salas
- "Bater na porta" (knock) - notificar participantes

### 3.4 Comunicação Real-Time
**Chat**:
- Mensagens diretas (DM) 1-1
- Canais de grupo
- Menções (@usuario)
- Histórico de mensagens (paginado)
- Marcação de leitura (read receipts)
- Contador de mensagens não lidas

**Videochamadas**:
- Iniciar/aceitar/rejeitar chamada
- Audio e vídeo
- Compartilhamento de tela
- Preview de mídia (testar câmera/microfone)
- Convite de participantes
- Ringtone para chamadas

**Notificações**:
- Toast notifications
- Notificações de chamadas
- Notificações de menções
- Notificações de comunicados

### 3.5 Sistema de Convites
- Criação de convite com código único
- Duração customizável (minutos)
- Expiração automática
- Visitante com acesso temporário
- Rastreamento de uso (usado/não usado)

### 3.6 Gerenciamento de Tarefas
- Criar/editar/deletar tarefas
- Status: `todo`, `in_progress`, `review`, `done`
- Prioridade: `low`, `medium`, `high`
- Atribuição de responsável
- Data de vencimento
- Tags (labels)
- Comentários em tarefas
- Menções em comentários
- Histórico de alterações
- Anexos (arquivos)
- Filtros por status e responsável

### 3.7 Comunicados/Anúncios
- Criar comunicado (admin/master)
- Título, mensagem e imagem
- Som personalizado (audio notification)
- Agendamento (envio futuro)
- Direcionamento (todos ou específicos)
- Rastreamento de leitura
- Estatísticas de visualização

### 3.8 Upload de Arquivos
- Upload de avatar
- Upload de logo do escritório
- Upload de arquivos genéricos
- Limite: 10MB por arquivo
- Storage: volume Docker persistente

### 3.9 Faturamento (Master)
**Planos**:
- Preço por usuário
- Número de usuários atual
- Cálculo automático de mensalidade
- Notas customizadas

**Pagamentos**:
- Registro de pagamentos
- Status: `pending`, `confirmed`, `overdue`
- Data de vencimento e pagamento
- Notas (forma de pagamento)

### 3.10 Analytics e Relatórios (Master)
- Estatísticas gerais (offices, usuários, salas)
- Usuários por escritório
- Horas online (últimos 30 dias)
- Receita mensal (últimos 12 meses)
- Atividade de login
- Engajamento por setor
- Resumo de atividades (actions)

### 3.11 Horário de Funcionamento
- Habilitar/desabilitar por office
- Horário de início e término
- Bloqueio de acesso fora do horário
- Admins podem acessar sempre

---

## 4. REGRAS DE NEGÓCIO

### 4.1 Controle de Acesso (Permissões)

| Funcionalidade | Master | Admin | User | Visitor |
|----------------|--------|-------|------|---------|
| **Escritórios** |
| Ver todos offices | ✓ | ✗ | ✗ | ✗ |
| Criar/editar office | ✓ | Próprio | ✗ | ✗ |
| Deletar office | ✓ | ✗ | ✗ | ✗ |
| **Usuários** |
| Ver usuários do office | ✓ | ✓ | ✓ | ✓ |
| Criar usuários | ✓ | ✓ | ✗ | ✗ |
| Editar usuários | ✓ | ✓ | Próprio | ✗ |
| Deletar usuários | ✓ | ✓ | ✗ | ✗ |
| Impersonate | ✓ | ✗ | ✗ | ✗ |
| **Salas** |
| Ver salas | ✓ | ✓ | ✓ | ✓ |
| Criar/editar salas | ✓ | ✓ | ✗ | ✗ |
| Entrar em salas | ✓ | ✓ | ✓ | ✓ |
| **Convites** |
| Criar/gerenciar | ✓ | ✓ | ✗ | ✗ |
| **Setores** |
| Criar/editar | ✓ | ✓ | ✗ | ✗ |
| Ver setores | ✓ | ✓ | ✓ | ✗ |
| **Chat** |
| Mensagens | ✓ | ✓ | ✓ | ✓ |
| Criar canais | ✓ | ✓ | ✓ | ✓ |
| **Tarefas** |
| Criar tarefas | ✓ | ✓ | ✓ | ✗ |
| Editar tarefas | ✓ | ✓ | Atribuídas | ✗ |
| **Comunicados** |
| Criar | ✓ | ✓ | ✗ | ✗ |
| Ver | ✓ | ✓ | ✓ | ✓ |
| **Analytics** |
| Ver analytics | ✓ | ✗ | ✗ | ✗ |
| **Faturamento** |
| Gerenciar | ✓ | ✗ | ✗ | ✗ |

### 4.2 Regras de Autenticação
- JWT gerado no login, armazenado em localStorage
- Token validado em cada request protegido
- Socket.io valida token na conexão
- Se email = `MASTER_EMAIL` → role automático = `master`
- Senhas hasheadas com bcrypt (10 rounds)
- Visitante: login com código único + nome (sem senha)

### 4.3 Regras de Isolamento (Multi-Tenant)
- Usuários só veem dados de seu office
- Master pode acessar qualquer office
- Queries filtram automaticamente por `officeId`
- WebSocket: usuários em rooms `office:${officeId}`
- Convites são válidos apenas para o office do criador

### 4.4 Regras de Status
- Status padrão ao conectar: `online`
- Status ao entrar em sala com chamada: `in_meeting`
- Status ao desconectar: `offline`
- Usuário pode mudar status manualmente (busy, away)
- Mensagem de status é opcional

### 4.5 Regras de Convites
- Código único gerado automaticamente
- Expiração baseada em `durationInMinutes`
- Código só pode ser usado uma vez
- Visitante tem acesso limitado (sem criar/editar)
- Visitante é usuário temporário (pode ser deletado)

### 4.6 Regras de Salas
- Capacidade máxima configurável (padrão: 10)
- Sala restrita: apenas membros autorizados
- "Bater na porta": notifica participantes atuais
- Ao sair da sala: status volta ao anterior (exceto offline)
- Owner da sala pode ter privilégios especiais

### 4.7 Regras de Chat
- DM: canal criado automaticamente entre 2 usuários
- Grupo: requer nome e lista de membros
- Mensagens têm menções opcionais
- Leitura rastreada por usuário
- Histórico paginado (50 mensagens padrão)

### 4.8 Regras de Tarefas
- Criador e responsável (assignee) podem ser diferentes
- Transições de status: todo → in_progress → review → done
- Comentários com menções notificam usuários
- Histórico registra todas as alterações
- Tags são array de strings (flexível)

### 4.9 Regras de Comunicados
- Apenas admin/master podem criar
- Se `scheduledFor` não fornecido: envia imediatamente
- Recipients vazio = todos do office
- ReadBy rastreia quem leu
- Som opcional toca ao receber

### 4.10 Regras de Upload
- Tamanho máximo: 10MB
- Arquivos salvos em `/app/uploads` (volume Docker)
- Nomes de arquivo devem ser sanitizados
- Avatar: substitui avatar anterior do usuário
- Logo: substitui logo do office

### 4.11 Regras de Faturamento
- Preço mensal = `pricePerUser * currentUsers`
- Pagamento `overdue` se vencido e não pago
- Apenas master acessa billing
- Histórico de pagamentos por plano

### 4.12 Regras de Analytics
- Apenas master visualiza
- ActivityLog registra todas as ações importantes
- Métricas agregadas por período
- Receita calculada a partir de pagamentos confirmados

### 4.13 Regras de Horário de Funcionamento
- Se habilitado: verifica horário atual
- Fora do horário: bloqueia acesso (exceto admins)
- Horário configurado por office
- Frontend exibe mensagem de "fechado"

---

## 5. BANCO DE DADOS

### 5.1 Principais Entidades

**User**
- Campos: id, email, password, name, avatar, role, status, statusMessage, jobTitle
- Relacionamentos: office, sector, currentRoom, visitorInvite

**Office**
- Campos: id, name, logo, primaryColor, workingHours*, enableGoogleChat, enableRocketChat
- Relacionamentos: users, sectors, rooms, billingPlan

**Sector**
- Campos: id, name, color, officeId
- Relacionamentos: office, users

**Room**
- Campos: id, name, type, capacity, isRestricted, color, backgroundImage, icon
- Relacionamentos: office, owner, participants

**VisitorInvite**
- Campos: id, code, expiresAt, durationInMinutes, creatorId, officeId

**ChatChannel**
- Campos: id, type (dm/group), name, officeId
- Relacionamentos: members, messages

**ChatMessage**
- Campos: id, text, mentions, channelId, senderId, editedAt

**Task**
- Campos: id, title, description, status, priority, dueDate, tags
- Relacionamentos: creator, assignee, comments, history

**Announcement**
- Campos: id, title, message, imageUrl, soundUrl, scheduledFor, recipients
- Relacionamentos: sender, readBy

**BillingPlan**
- Campos: id, officeId, pricePerUser, currentUsers, notes

**Payment**
- Campos: id, billingPlanId, amount, status, dueDate, paidAt

**ActivityLog**
- Campos: id, userId, officeId, action, details

### 5.2 Enums

```typescript
enum UserRole {
  master, admin, user, visitor
}

enum UserStatus {
  online, busy, away, offline, in_meeting
}

enum TaskStatus {
  todo, in_progress, review, done
}

enum TaskPriority {
  low, medium, high
}

enum ChannelType {
  dm, group
}

enum PaymentStatus {
  pending, confirmed, overdue
}
```

---

## 6. APIS PRINCIPAIS

### 6.1 Autenticação
- `POST /api/auth/login` - Login funcionário
- `POST /api/auth/visitor` - Login visitante
- `GET /api/auth/me` - Dados do usuário logado
- `POST /api/auth/change-password` - Alterar senha
- `POST /api/auth/logout` - Logout
- `POST /api/auth/impersonate/:userId` - Impersonate (master)

### 6.2 Usuários
- `GET /api/users` - Listar usuários
- `POST /api/users` - Criar usuário
- `PUT /api/users/:id` - Atualizar usuário
- `PATCH /api/users/:id/status` - Atualizar status
- `DELETE /api/users/:id` - Deletar usuário

### 6.3 Escritórios
- `GET /api/office` - Obter office do usuário
- `PUT /api/office` - Atualizar office
- `GET /api/office/all` - Listar todos (master)
- `POST /api/office/create` - Criar office (master)
- `DELETE /api/office/:id` - Deletar office (master)

### 6.4 Salas
- `GET /api/rooms` - Listar salas
- `POST /api/rooms` - Criar sala
- `PUT /api/rooms/:id` - Atualizar sala
- `DELETE /api/rooms/:id` - Deletar sala
- `POST /api/rooms/:id/join` - Entrar em sala
- `POST /api/rooms/:id/leave` - Sair de sala
- `POST /api/rooms/:id/knock` - Bater na porta

### 6.5 Convites
- `GET /api/invites` - Listar convites
- `POST /api/invites` - Criar convite
- `DELETE /api/invites/:id` - Deletar convite
- `GET /api/invites/validate/:code` - Validar código

### 6.6 Chat
- `GET /api/channels` - Listar canais
- `POST /api/channels` - Criar canal
- `GET /api/channels/:id/messages` - Obter mensagens
- `POST /api/channels/:id/messages` - Enviar mensagem
- `POST /api/channels/:id/read` - Marcar como lido

### 6.7 Tarefas
- `GET /api/tasks` - Listar tarefas
- `GET /api/tasks/:id` - Detalhes da tarefa
- `POST /api/tasks` - Criar tarefa
- `PUT /api/tasks/:id` - Atualizar tarefa
- `DELETE /api/tasks/:id` - Deletar tarefa
- `POST /api/tasks/:id/comments` - Adicionar comentário

### 6.8 Comunicados
- `GET /api/announcements` - Listar comunicados
- `POST /api/announcements` - Criar comunicado
- `POST /api/announcements/:id/read` - Marcar como lido
- `DELETE /api/announcements/:id` - Deletar comunicado

### 6.9 Upload
- `POST /api/upload/avatar` - Upload avatar
- `POST /api/upload/logo` - Upload logo
- `POST /api/upload/file` - Upload arquivo genérico

### 6.10 Faturamento (Master)
- `GET /api/billing/plans` - Listar planos
- `POST /api/billing/plans` - Criar plano
- `GET /api/billing/payments/:planId` - Listar pagamentos
- `POST /api/billing/payments` - Registrar pagamento
- `PUT /api/billing/payments/:id` - Atualizar pagamento

### 6.11 Analytics (Master)
- `GET /api/analytics/stats` - Estatísticas gerais
- `GET /api/analytics/users-by-office` - Usuários por office
- `GET /api/analytics/online-hours` - Horas online
- `GET /api/analytics/revenue` - Receita
- `GET /api/analytics/login-activity` - Atividade login
- `GET /api/analytics/engagement-by-sector` - Engajamento por setor

---

## 7. WEBSOCKET (Socket.io)

### 7.1 Configuração
- Path: `/api/socket.io`
- Autenticação: JWT via `socket.handshake.auth.token`
- Rooms: `office:${officeId}`, `room:${roomId}`

### 7.2 Eventos Cliente → Servidor
- `user:join-office` - Entrar no office
- `user:change-status` - Mudar status
- `room:join` - Entrar em sala
- `room:leave` - Sair de sala
- `room:knock` - Bater na porta
- `call:initiate` - Iniciar chamada
- `call:accept` - Aceitar chamada
- `call:reject` - Rejeitar chamada
- `call:end` - Encerrar chamada
- `message:send` - Enviar mensagem

### 7.3 Eventos Servidor → Cliente
- `users:initial-state` - Estado inicial dos usuários
- `user:online` - Usuário online
- `user:offline` - Usuário offline
- `user:status-changed` - Status mudou
- `room:user-joined` - Usuário entrou em sala
- `room:user-left` - Usuário saiu de sala
- `room:knocked` - Alguém bateu na porta
- `call:incoming` - Chamada recebida
- `call:accepted` - Chamada aceita
- `call:rejected` - Chamada rejeitada
- `call:ended` - Chamada encerrada
- `message:new` - Nova mensagem
- `announcement:new` - Novo comunicado
- `task:mentioned` - Menção em tarefa

---

## 8. CONFIGURAÇÃO

### 8.1 Variáveis de Ambiente (.env)

```env
# Database
ESCRITORIO_DB_PASSWORD=<senha-segura>

# JWT
JWT_SECRET=<chave-secreta>

# Master User
MASTER_EMAIL=admin@example.com

# Optional
GEMINI_API_KEY=<chave-ia>
```

### 8.2 Docker Compose

**Serviços**:
- `postgres` - PostgreSQL 15
- `backend` - Fastify (porta 3001)
- `frontend` - Nginx (porta 80)
- `postgres-check` - Health check

**Volumes**:
- `postgres_data` - Dados do banco
- `uploads` - Arquivos enviados

**Networks**:
- `default` - Rede interna
- `traefik-net` - Roteamento externo

---

## 9. DEPLOYMENT

### 9.1 Deploy Inicial

```bash
# 1. Clonar repositório
git clone https://github.com/yagogavilan/escritorio-virtual-2.git
cd escritorio-virtual-2

# 2. Configurar .env
cp .env.example .env
nano .env

# 3. Build e start
docker-compose up -d --build

# 4. Aplicar migrações
docker-compose exec backend npx prisma migrate deploy

# 5. (Opcional) Seed
docker-compose exec backend npm run prisma:seed

# 6. Verificar
curl https://escritorio.insightsmeet.com.br/api/health
```

### 9.2 Atualização

```bash
# 1. Backup
docker-compose exec postgres pg_dump -U escritorio escritorio > backup.sql

# 2. Pull novo código
git pull origin main

# 3. Rebuild
docker-compose up -d --build

# 4. Migrações
docker-compose exec backend npx prisma migrate deploy
```

### 9.3 Backup

```bash
# Backup manual
docker-compose exec postgres pg_dump -U escritorio escritorio > backup.sql

# Restore
docker-compose exec -T postgres psql -U escritorio escritorio < backup.sql
```

---

## 10. SEGURANÇA

### 10.1 Implementado
✓ JWT para autenticação
✓ Bcrypt para senhas (10 rounds)
✓ Prisma ORM (prevenção SQL Injection)
✓ CORS habilitado
✓ Limite de upload (10MB)
✓ Isolamento multi-tenant
✓ Validação com Zod

### 10.2 Recomendações
⚠️ Rate limiting
⚠️ Refresh tokens
⚠️ Whitelist de extensões (upload)
⚠️ Headers de segurança (Helmet.js)
⚠️ Proteção brute force
⚠️ Content Security Policy

---

## RESUMO EXECUTIVO

**O que é**: Plataforma de escritório virtual com comunicação em tempo real, gerenciamento de tarefas, videochamadas e analytics.

**Tecnologias**: TypeScript, React, Fastify, PostgreSQL, Socket.io, Docker.

**Principais Features**:
- Multi-tenant (múltiplos escritórios isolados)
- Chat em tempo real (DM e grupos)
- Videochamadas integradas
- Sistema de tarefas completo
- Convites temporários para visitantes
- Analytics e faturamento
- Permissões granulares (master/admin/user/visitor)

**Arquitetura**: Backend REST API + WebSocket, frontend React SPA, PostgreSQL, deploy Docker com SSL automático.

**Segurança**: JWT, bcrypt, isolamento por office, validação de schemas.

---

**Contato**: yago.tgavilan@gmail.com
**Versão**: 2.0
**Data**: Janeiro 2025
