# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is a real-time location sharing application built as a monorepo:
- **Root**: Bun workspace configuration with unified commands
- **Frontend**: React 19 + TypeScript + Vite + Mapbox GL JS for interactive mapping
- **Backend**: Express + tRPC + WebSocket + Redis for real-time location tracking

### Architecture Overview
- **Frontend**: React app with Mapbox integration, real-time WebSocket connections, and tRPC client
- **Backend**: Express server with tRPC API, WebSocket handler for live updates, Redis for location storage
- **Real-time Communication**: WebSocket connections for live location updates and timeline playback
- **Data Flow**: tRPC for API calls, WebSocket for real-time updates, Redis for persistence

## Development Commands

### Full Stack Development
```bash
# Install all dependencies
bun install

# Run all workspaces in development mode
bun run dev

# Build all workspaces
bun run build

# Lint all workspaces
bun run lint
```

### Frontend (from frontend/ directory)
```bash
# Development server (Vite dev server on port 5173)
bun run dev

# Build for production
bun run build

# Lint with ESLint
bun run lint

# Format code with Prettier
bun run format

# Preview production build
bun run preview

# Generate mock data for testing
bun run generate-mock-data
```

### Backend (from backend/ directory)
```bash
# Development server with hot reload (port 3000)
bun run dev

# Production build
bun run build

# Start production server
bun run start

# Run tests
bun run test

# Health check
bun run healthcheck

# Docker commands
bun run docker:dev          # Start Redis with Docker Compose
bun run docker:dev:down     # Stop Docker services
bun run docker:dev:logs     # View Docker logs
```

### Redis Setup
The backend requires Redis for location storage:
```bash
# Start Redis via Docker (recommended)
cd backend && bun run docker:dev

# Or install Redis locally and run on port 6379
```

## Technology Stack

### Core Technologies
- **Runtime**: Bun (replaces Node.js, npm, pnpm per project rules)
- **Frontend**: React 19, TypeScript, Vite, Mapbox GL JS, TailwindCSS
- **Backend**: Express, tRPC, TypeScript, Redis, WebSocket (ws)
- **UI Components**: Vaul (drawer component), FontAwesome icons
- **Data Fetching**: TanStack Query + tRPC client

### Key Dependencies
- **Maps**: `mapbox-gl` for interactive mapping and visualization
- **Real-time**: `ws` WebSocket server, custom WebSocket client hooks
- **API**: tRPC for type-safe API calls between frontend/backend
- **Database**: Redis for location data storage and caching
- **Security**: Helmet, CORS, express-rate-limit

## Architecture Patterns

### Frontend Architecture
- **State Management**: React hooks + TanStack Query for server state
- **Real-time Updates**: Custom WebSocket hooks (`useWebSocket`) for live location data
- **Map Management**: MapView component with TimelineController for timeline playback
- **API Layer**: tRPC client with type-safe API calls

### Backend Architecture
- **API Layer**: tRPC router with health, location endpoints
- **Real-time**: SocketHandler class manages WebSocket connections
- **Data Layer**: LocationService class handles Redis operations
- **Middleware**: Rate limiting, CORS, helmet security, error handling

### Key Services
- **LocationService** (`backend/src/services/locationService.ts`): Redis-based location storage
- **SocketHandler** (`backend/src/websocket/socketHandler.ts`): WebSocket connection management
- **TimelineController** (`frontend/src/utils/TimelineController.ts`): Map timeline playback

## Important Notes

- Always use `bun` commands instead of npm, yarn, or pnpm
- Backend requires Redis connection (start with `docker:dev` command)
- Frontend connects to backend on localhost:3000, serves on localhost:5173
- CORS is configured for local development and custom origins via CORS_ORIGIN env var
- Rate limiting is implemented for API endpoints and location submissions
- WebSocket endpoint available at `/api/live` for real-time updates