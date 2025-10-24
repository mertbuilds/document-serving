# Cloudflare Workers + React Template

Full-stack template combining React (TypeScript + Vite) frontend with Cloudflare Workers backend. Deploy your entire application to Cloudflare's edge network.

## Quick Start

```bash
npm install
npm run dev      # Start development server
npm run deploy   # Build and deploy to Cloudflare
```

## Architecture

- **Frontend**: React app in `src/` built with Vite
- **Backend**: Cloudflare Worker in `worker/` handles API routes
- **Deploy**: Single command deploys both frontend and backend to edge
