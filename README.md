# Audio Mixer

A modern web application for audio mixing and processing, built with React, TypeScript, and Express.js.

## Features

- 🎵 Audio file upload and processing
- 🎚️ Real-time audio mixing controls
- 📊 Waveform visualization
- 🎨 Modern, responsive UI with Tailwind CSS
- 🔄 Real-time audio preview
- 📱 Mobile-friendly interface

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Radix UI
- **Backend**: Express.js, Node.js
- **Audio Processing**: FFmpeg
- **Database**: Drizzle ORM with Neon Database
- **Build Tool**: Vite
- **State Management**: React Query, React Hook Form

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- FFmpeg installed on your system

### Installation

1. Clone the repository:
```bash
git clone https://github.com/itzsarim/audio-mixer.git
cd audio-mixer
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Run the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run check` - Type checking
- `npm run db:push` - Push database schema changes

## Project Structure

```
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── pages/         # Page components
│   │   └── lib/           # Utility functions
├── server/                 # Backend Express.js server
│   ├── routes/            # API routes
│   ├── storage.ts         # File storage logic
│   └── index.ts           # Server entry point
├── shared/                 # Shared types and schemas
└── uploads/                # Audio file uploads
```

## Deployment

This project is configured for automatic deployment to Vercel. Simply push to the main branch and Vercel will automatically build and deploy your application.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

MIT License - see LICENSE file for details
