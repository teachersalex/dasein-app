# Dasein Social

Rede social minimalista de fotos. Sua casa online.

## Setup

```bash
# Instalar dependências
npm install

# Rodar local
npm run dev

# Build para produção
npm run build
```

## Deploy (Vercel)

1. Cria conta na [Vercel](https://vercel.com)
2. Conecta com seu GitHub
3. Importa o repositório `dasein-social`
4. Deploy automático!

### Configurar domínio

1. No painel da Vercel, vai em Settings > Domains
2. Adiciona `getdasein.app`
3. No painel do seu domínio, aponta os DNS:
   - Tipo: CNAME
   - Nome: @
   - Valor: cname.vercel-dns.com

## Estrutura

```
src/
├── components/     # Componentes reutilizáveis
├── hooks/          # Custom hooks (useAuth, etc)
├── lib/            # Firebase, filtros, invites, posts
├── pages/          # Páginas da aplicação
└── styles/         # CSS global
```

## Stack

- React 18
- Vite
- React Router
- Firebase (Auth, Firestore, Storage)
