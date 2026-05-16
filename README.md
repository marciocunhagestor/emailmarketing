# EmailFlow — Email Marketing

## Rodar localmente

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Edite o .env com suas credenciais SMTP

# 3. Iniciar
npm start
# Acesse: http://localhost:3000
```

## Deploy no Vercel

### 1. Criar banco de dados Turso (gratuito)

```bash
# Instalar CLI do Turso
npm install -g @turso/cli

# Login
turso auth login

# Criar banco
turso db create emailmarketing

# Pegar a URL
turso db show emailmarketing --url

# Criar token de acesso
turso db tokens create emailmarketing
```

### 2. Subir para o GitHub

```bash
git init
git add .
git commit -m "first commit"
git remote add origin https://github.com/seu-usuario/emailmarketing.git
git push -u origin main
```

### 3. Conectar ao Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login
2. Clique em **"Add New Project"**
3. Importe o repositório do GitHub
4. Em **"Environment Variables"**, adicione:

| Variável | Valor |
|---|---|
| `TURSO_DATABASE_URL` | URL gerada pelo Turso |
| `TURSO_AUTH_TOKEN` | Token gerado pelo Turso |
| `SMTP_HOST` | Ex: `mail.seudominio.com.br` |
| `SMTP_PORT` | `465` |
| `SMTP_SECURE` | `true` |
| `SMTP_USER` | Ex: `marketing@seudominio.com.br` |
| `SMTP_PASS` | Senha do email |
| `SMTP_FROM_NAME` | Seu nome ou empresa |
| `SMTP_FROM_EMAIL` | Ex: `marketing@seudominio.com.br` |

5. Clique em **"Deploy"**

> **Nota:** O agendador de campanhas (cron) não roda no Vercel. Campanhas agendadas precisam ser enviadas manualmente ou via [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs).
