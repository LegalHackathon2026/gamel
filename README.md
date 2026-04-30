# Gamell — Gamified AI-Powered Legal/Law Learning Platform

Gamell is a comprehensive gamified AI-powered legal/Law learning platform designed to make Nigerian law accessible and engaging through interactive scenarios, flashcards, AI-powered legal Q&A, and community discussions with verified lawyers.

## 🎯 Features

- **🎮 Gamified Learning**: RPG-style scenarios and flashcards with XP, levels, and streaks
- **🤖 AI Legal Assistant**: RAG-powered Q&A using Gemini, Claude, or OpenAI
- **👥 Legal Community**: Discussion forums with verified lawyers and legal experts
- **📊 Progress Tracking**: Comprehensive dashboard with learning analytics
- **🔐 Secure Authentication**: Supabase Auth with role-based access (users, lawyers, admins)
- **📱 Responsive Design**: Modern UI with Gamell branding (deep blue & emerald green)

## 🛠 Tech Stack

- **Frontend**: Next.js 15 + TypeScript
- **Database**: Supabase (Postgres + pgvector for RAG)
- **Authentication**: Supabase Auth with Row Level Security (RLS)
- **AI Providers**: Gemini (primary), OpenAI GPT, Claude (fallback)
- **Embeddings**: Gemini `text-embedding-004` (768 dimensions)
- **Styling**: Tailwind CSS with custom Gamell theme
- **Deployment**: Vercel-ready with environment configuration

## 📁 Project Structure

```
gamell/
├── app/
│   ├── api/
│   │   ├── ask/
│   │   │   └── route.ts
│   │   ├── ingest/ (folder and file removed for now)
│   │   │   └── route.js 
│   │   └── seed/ (folder and file removed for now)
│   │       └── route.js
│   ├── auth/
│   │   └── page.tsx
│   ├── chat/
│   │   └── page.tsx
│   ├── community/
│   │   └── page.tsx
│   ├── dashboard/
│   │   └── page.tsx
│   ├── learn/
│   │   ├── facts/
│   │   │   └── page.tsx
│   │   ├── flashcards/
│   │   │   └── page.tsx
│   │   ├── rpg/
│   │   │   └── page.tsx
│   │   └── page.tsx
│   ├── profile/
│   │   └── page.tsx
│   ├── error.tsx
│   ├── globals.css
│   ├── layout.tsx
│   ├── not-found.tsx
│   └── page.tsx
├── components/
│   ├── BottomNav.tsx
│   ├── NavWrapper.tsx
│   ├── Sidebar.tsx
│   ├── ThemeProvider.tsx
│   └── ThemeToggle.tsx
├── lib/
│   ├── chunk.js
│   ├── clean.js
│   ├── embeddings.js
│   ├── websearch.js
│   ├── gamification.ts
│   ├── supabaseClient.ts
│   └── types.ts
├── scripts/
│   ├── ingest-pdf.js
│   ├── ingest-web.js
│   ├── scraper.js
│   └── seed-gamell-data.js
├── supabase/
│   └── schema.sql
├── .env.example
├── .eslintrc.json
├── .gitignore
├── README.md
├── eslint.config.mjs
├── globals.d.ts
├── next-env.d.ts
├── next.config.ts
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── postcss.config.mjs
└── tsconfig.json
```

## 🚀 Quick Start

### 1. Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase account and project

### 2. Installation

```bash
# Clone the repository
git clone <repository-url>
cd gamell

# Install dependencies
npm install
# or
pnpm install
```

### 3. Environment Setup

Create a `.env.local`or `.env` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# AI Provider API Keys
GOOGLE_AI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_claude_api_key

# Optional: Brave Search for web scraping
BRAVE_API_KEY=your_brave_search_api_key
```

### 4. Database Setup

```bash
# Push the schema to your Supabase project
npm run db:push

# Seed sample data (scenarios and flashcards)
# Visit http://localhost:3000/api/seed in your browser or use curl:
curl -X POST http://localhost:3000/api/seed
```

### 5. Development

```bash
# Start the development server
npm run dev
# or
pnpm dev

# Open http://localhost:3000 in your browser
```

### 6. Build for Production

```bash
# Build the application
npm run build

# Start production server
npm start
```

## 📚 Database Schema

The application uses the following main tables:

- **users**: Extended user profiles with XP, levels, streaks
- **scenarios**: Interactive legal learning scenarios with choices
- **flashcards**: Legal concept flashcards with topics and difficulty
- **posts**: Community discussion posts
- **replies**: Replies to community posts
- **documents**: Legal documents for RAG (chunks stored via pgvector)
- **user_progress**: Learning progress tracking

See `supabase/schema.sql` for the complete schema with RLS policies.

## 🎮 Gamification System

- **XP System**: Earn XP through scenario completion, flashcard reviews, and community participation
- **Levels**: Automatic level progression based on XP thresholds
- **Streaks**: Daily learning streaks with bonus multipliers
- **Leaderboards**: Community rankings and achievements

## 🤖 AI Integration

- **Primary AI**: Gemini 1.5 Pro for both embeddings and chat
- **Fallback AIs**: OpenAI GPT-4 and Claude 3 Sonnet
- **RAG Pipeline**: Vector search over Nigerian legal documents
- **Multi-provider**: Runtime switching between AI providers

## 🔐 Authentication & Security

- **Supabase Auth**: Email/password authentication with magic links
- **Row Level Security**: Database-level access control
- **Role-based Access**: User, lawyer, and admin roles
- **Secure API**: Protected endpoints with authentication checks

## 🎨 Design System

- **Primary Colors**: Deep blue (#1E3A8A) for authority, emerald green (#22C55E) for growth
- **Typography**: Clean, readable fonts with proper hierarchy
- **Components**: Reusable UI components with consistent styling
- **Responsive**: Mobile-first design that works on all devices

## 📊 API Endpoints

- `POST /api/ask`: AI-powered legal Q&A with RAG
- `POST /api/seed`: Seed database with sample data
- `POST /api/ingest`: Ingest legal documents for RAG

## 🚀 Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push

### Manual Deployment

```bash
# Build the application
npm run build

# Start production server
npm start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built for the Nigerian legal community
- Powered by Supabase, Google Gemini, and Next.js
- Inspired by the need for accessible legal education

---

**Gamell** - Making Nigerian law accessible, engaging, and fun! 🇳🇬⚖️
