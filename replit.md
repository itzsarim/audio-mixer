# Audio Editor Application

## Overview

This is a full-stack audio editing application built with React frontend and Express.js backend. The application allows users to upload audio files, segment them, and process them with various output modes including direct concatenation and crossfade effects. The system uses a PostgreSQL database with Drizzle ORM for data persistence and FFmpeg for audio processing.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack React Query for server state management
- **UI Framework**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Runtime**: Node.js with ES modules
- **File Processing**: FFmpeg (fluent-ffmpeg) for audio manipulation
- **File Upload**: Multer for handling multipart/form-data
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon Database (serverless PostgreSQL)

## Key Components

### Database Schema
Located in `shared/schema.ts`, the application uses three main tables:
- **audio_files**: Stores uploaded audio file metadata (filename, duration, format, upload timestamp)
- **segments**: Defines time segments within audio files (start/end times, order)
- **processing_jobs**: Tracks audio processing operations (output mode, status, crossfade settings)

### Frontend Components
- **AudioEditor**: Main application page with step-based workflow
- **ProgressSteps**: Visual progress indicator for the 4-step process
- **WaveformVisualizer**: Audio playback and visual waveform representation
- **SegmentManager**: Interface for defining and managing audio segments
- **UI Components**: Comprehensive set of reusable components from Shadcn/ui

### Backend Services
- **Storage Layer**: Abstracted storage interface with in-memory implementation
- **File Upload**: Handles audio file uploads with validation (MP3/WAV, 100MB limit, 60-minute duration)
- **Audio Processing**: FFmpeg integration for metadata extraction and audio manipulation

## Data Flow

1. **Upload Phase**: User uploads audio file → Backend validates and extracts metadata → File stored with database record
2. **Segmentation Phase**: User defines time segments through UI → Segments validated and stored
3. **Processing Phase**: User configures output options → Background job processes audio with FFmpeg → Processed file generated
4. **Download Phase**: User downloads the processed audio file

## External Dependencies

### Core Dependencies
- **Database**: Neon Database (PostgreSQL) via `@neondatabase/serverless`
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Audio Processing**: FFmpeg (system dependency)
- **UI Components**: Radix UI primitives for accessible components
- **State Management**: TanStack React Query for API state
- **File Handling**: Multer for uploads, connect-pg-simple for sessions

### Development Tools
- **TypeScript**: Full type safety across the stack
- **Vite**: Frontend build tool with HMR
- **ESBuild**: Backend bundling for production
- **Tailwind CSS**: Utility-first styling

## Deployment Strategy

### Development
- Frontend served by Vite dev server with HMR
- Backend runs with tsx for TypeScript execution
- Hot reload enabled for rapid development

### Production
- Frontend built to static assets via Vite
- Backend bundled with ESBuild to single JavaScript file
- Static assets served by Express in production
- Database migrations handled via Drizzle Kit

### Environment Requirements
- **Node.js**: ES modules support required
- **Database**: PostgreSQL connection via DATABASE_URL
- **FFmpeg**: System-level installation for audio processing
- **File Storage**: Local filesystem for uploaded and processed files

### Key Design Decisions

1. **Monorepo Structure**: Shared types and schemas between frontend/backend for type safety
2. **In-Memory Storage**: Current implementation uses memory storage; easily replaceable with database storage
3. **Step-Based UX**: Progressive workflow reduces complexity and guides user through process
4. **Type-Safe API**: Shared schema definitions ensure API contract consistency
5. **Modular Components**: Highly reusable UI components following atomic design principles
6. **Error Boundaries**: Comprehensive error handling throughout the application stack