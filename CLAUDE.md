# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is a monorepo with frontend and backend workspaces managed by Bun:
- **Root**: Main package.json with workspace configuration
- **Frontend**: React + TypeScript + Vite application in `frontend/`
- **Backend**: Simple Bun TypeScript application in `backend/`

## Development Commands

### Frontend (from root or frontend/ directory)
```bash
# Development server
cd frontend && bun run dev

# Build for production
cd frontend && bun run build

# Lint code
cd frontend && bun run lint

# Preview production build
cd frontend && bun run preview
```

### Backend (from root or backend/ directory)
```bash
# Run backend
cd backend && bun run index.ts
# or
cd backend && bun index.ts
```

### Root Level
```bash
# Install all dependencies (frontend + backend)
bun install
```

## Technology Stack

- **Runtime**: Bun (preferred over Node.js, npm, pnpm per cursor rules)
- **Frontend**: React 19, TypeScript, Vite, ESLint
- **Backend**: Bun runtime with TypeScript
- **Build Tool**: Vite (frontend), Bun (backend)

## Important Notes

- Use `bun` commands instead of `npm`, `yarn`, or `pnpm`
- Frontend uses React 19 with modern TypeScript configuration
- Backend is a minimal Bun application
- Both frontend and backend are private packages in a workspace setup