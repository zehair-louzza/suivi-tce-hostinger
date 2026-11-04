# Suivi TCE — Hostinger Deployable

Application complète de suivi des devis et interventions TCE, déployable sur **Hostinger VPS** (Node.js + SQLite).

## 🏗️ Architecture

```
suivi-tce-hostinger/
├── package.json                 # Single package.json (no workspaces)
├── tsconfig.json                # Client TypeScript config
├── tsconfig.server.json         # Server TypeScript config
├── tsconfig.node.json           # Vite config
├── vite.config.ts               # Vite config with proxy
├── .env.example                 # Environment template
├── .gitignore
├── prisma/
│   └── schema.prisma            # SQLite schema (User, Devis, Intervention)
├── server/
│   ├── index.ts                 # Express + Socket.io entry
│   ├── config.ts                # Configuration
│   ├── lib/prisma.ts            # Prisma singleton
│   ├── middleware/
│   │   ├── auth.ts              # JWT + roles
│   │   └── errorHandler.ts
│   ├── routes/
│   │   ├── auth.ts              # /api/auth/*
│   │   ├── devis.ts             # /api/devis/* + conversion
│   │   ├── interventions.ts     # /api/interventions/*
│   │   └── health.ts
│   ├── socket/index.ts          # Socket.io real-time
│   └── db/
│       ├── init.ts              # DB initialization
│       └── seed.ts              # Sample data
├── client/
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx             # Entry + providers
│   │   ├── App.tsx              # Routes
│   │   ├── components/
│   │   │   ├── Layout.tsx       # Sidebar + Header
│   │   │   └── ProtectedRoute.tsx
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx    # Login/Register
│   │   │   └── DashboardPage.tsx # Main dashboard
│   │   ├── hooks/useSocket.ts   # Real-time sync
│   │   ├── stores/authStore.tsx # Zustand auth
│   │   ├── lib/api.ts           # Axios + types
│   │   └── styles/
│   │       ├── design-tokens.css
│   │       └── global.css
│   └── styles/
└── shared/types.ts              # Shared types + Zod schemas
```

## 🚀 Stack Technique

| Layer | Tech |
|-------|------|
| **Frontend** | React 18 + TypeScript + Vite |
| **State** | TanStack Query v5 + Zustand |
| **UI** | CSS Custom Properties (Linear-inspired dark theme) |
| **Forms** | React Hook Form + Zod |
| **Real-time** | Socket.io (client + server) |
| **Backend** | Express + TypeScript + Prisma |
| **Database** | **SQLite** (file-based, perfect for Hostinger) |
| **Auth** | JWT + HttpOnly cookies (access + refresh) |
| **Validation** | Zod (shared schemas) |

## 📦 Installation Locale

### Prérequis
- Node.js 20+
- npm 10+

### 1. Cloner et installer
```bash
git clone <votre-repo>
cd suivi-tce-hostinger
npm install
```

### 2. Configuration
```bash
cp .env.example .env
# Éditez .env avec vos secrets (JWT_SECRET, COOKIE_SECRET, etc.)
```

### 3. Base de données
```bash
# Générer Prisma Client
npx prisma generate

# Créer la base + migrations
npx prisma migrate dev --name init

# (Optionnel) Seed données démo
npm run db:seed
```

### 4. Développement
```bash
# Lance client (5173) + server (3001)
npm run dev
```

**Accès** :
- Frontend : http://localhost:5173
- Backend API : http://localhost:3001/api
- Health check : http://localhost:3001/api/health
- Compte démo : `demo@suivi-tce.fr` / `demo1234`

## 🏭 Build Production

```bash
# Build client + server
npm run build

# Crée :
# dist/client/     # Fichiers statiques (HTML, CSS, JS)
# dist/server/     # Code serveur compilé
```

## 🌐 Déploiement sur Hostinger VPS

### 1. Préparer le VPS
```bash
# Sur votre VPS Ubuntu 22.04+
sudo apt update && sudo apt install -y nodejs npm nginx
# Ou installez Node 20 via nvm
```

### 2. Déployer l'application
```bash
# Sur votre machine locale
npm run build

# Copier sur le VPS
rsync -avz dist/ user@votre-vps:/var/www/suivi-tce/
rsync -avz prisma/ user@votre-vps:/var/www/suivi-tce/prisma/
rsync -avz package.json package-lock.json user@votre-vps:/var/www/suivi-tce/
scp .env user@votre-vps:/var/www/suivi-tce/.env

# Sur le VPS
cd /var/www/suivi-tce
npm ci --production
npx prisma generate
npx prisma migrate deploy
```

### 3. Configuration Nginx (Reverse Proxy)
```nginx
# /etc/nginx/sites-available/suivi-tce
server {
    listen 80;
    server_name votre-domaine.com;

    # Frontend statique
    location / {
        root /var/www/suivi-tce/dist/client;
        try_files $uri $uri/ /index.html;
        
        # Cache assets
        location ~* \.(js|css|png|jpg|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API + Socket.io
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/suivi-tce /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 4. PM2 pour le processus Node
```bash
sudo npm install -g pm2

# ecosystem.config.js
module.exports = {
  apps: [{
    name: 'suivi-tce',
    script: 'dist/server/index.js',
    cwd: '/var/www/suivi-tce',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      DATABASE_URL: 'file:./data.db',
      JWT_SECRET: 'votre-secret-64-chars',
      COOKIE_SECRET: 'votre-cookie-secret',
      CORS_ORIGIN: 'https://votre-domaine.com',
      SOCKET_CORS_ORIGIN: 'https://votre-domaine.com',
    },
  }],
};

pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 5. SSL avec Certbot
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d votre-domaine.com
```

## 🗄️ Base de Données SQLite

L'application utilise **SQLite** (fichier `data.db`) - idéal pour Hostinger :
- Pas de serveur DB séparé
- Fichier unique, facile à sauvegarder
- Performances excellentes pour charges modérées
- `npx prisma migrate deploy` pour les migrations en prod

**Sauvegarde automatique** :
```bash
# Cron quotidien
0 3 * * * cp /var/www/suivi-tce/data.db /var/backups/suivi-tce/data-$(date +\%F).db
```

## 🎯 Fonctionnalités

| Feature | Description |
|---------|-------------|
| **Devis CRUD** | Créer, lire, modifier, supprimer + stats |
| **Interventions CRUD** | Idem + traçabilité |
| **Conversion Devis→Intervention** | Mapping auto + badge 🔗 traçabilité |
| **Temps réel** | Socket.io (création/MAJ/suppression instantanée) |
| **Auth JWT** | Access/Refresh tokens HttpOnly cookies |
| **Rôles** | ADMIN, USER, VIEWER |
| **Recherche/Filtres** | Par texte, statut, pagination |
| **Design System** | Linear-inspired dark mode, CSS tokens |

## 🔧 Scripts Utiles

```bash
npm run dev              # Dev client + server
npm run dev:server       # Server only
npm run dev:client       # Client only
npm run build            # Build production
npm run start            # Start production server
npm run db:init          # Init DB
npm run db:seed          # Seed sample data
npm run db:studio        # Prisma Studio (GUI)
npm run lint             # ESLint
```

## 📁 Variables d'Environnement (Production)

```env
DATABASE_URL=file:./data.db
JWT_SECRET=your-64-char-random-secret
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://votre-domaine.com
SOCKET_CORS_ORIGIN=https://votre-domaine.com
COOKIE_SECRET=your-cookie-secret
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

Générez les secrets :
```bash
openssl rand -base64 48  # Pour JWT_SECRET
openssl rand -base64 32  # Pour COOKIE_SECRET
```

## 📝 Licence

MIT