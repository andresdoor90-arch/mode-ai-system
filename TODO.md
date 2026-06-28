# M-A-S (Mode AI System) - TODO

> Priority levels: P0 (Critical), P1 (High), P2 (Medium), P3 (Low)
> Status: [ ] Not Started, [~] In Progress, [x] Done, [!] Blocked

---

## Phase 1: Project Foundation & Setup

> ✅ Completed 2026-06-28 (Sprint 1). Awaiting approval before Phase 2.

### P0 - Monorepo & Build Configuration
- [x] Initialize pnpm workspace with `pnpm-workspace.yaml`
- [x] Create root `package.json` with workspace scripts
- [x] Set up TypeScript base config (`tsconfig.base.json`)
- [x] Configure path aliases for cross-package imports
- [x] Create `apps/desktop/` Electron + Vite project scaffold
- [x] Create `packages/core/` package scaffold
- [x] Create `packages/infrastructure/` package scaffold
- [x] Create `packages/plugin-sdk/` package scaffold
- [x] Configure Vite for Electron (main, preload, renderer)
- [x] Set up environment variables handling (`.env`, `.env.local`)

### P0 - Code Quality & Standards
- [x] Configure ESLint with TypeScript rules
- [x] Configure Prettier for consistent formatting
- [x] Set up Husky pre-commit hooks
- [x] Configure lint-staged for staged file linting
- [x] Add commitlint for conventional commit messages
- [x] Create `.editorconfig` for editor consistency

### P1 - Testing Infrastructure
- [x] Set up Vitest as test runner
- [x] Configure test coverage reporting
- [x] Set up testing utilities (React Testing Library)
- [x] Create test fixtures and factories
- [x] Configure Playwright for E2E tests (Electron)

### P2 - CI/CD Pipeline
- [x] Create GitHub Actions workflow for PR checks
- [x] Add build verification step
- [x] Add test execution step
- [x] Add lint and type-check steps
- [x] Configure artifact caching for faster builds

---

## Phase 2: Core Domain Package (`packages/core`)

> ✅ Completed 2026-06-29 (Sprint 2). Pure, framework-agnostic domain. Awaiting approval before Phase 3.

### P0 - Domain Entities
- [x] `Garment` entity (id, name, category, subcategory, color, brand, size, season, images, tags, metadata)
- [x] `Outfit` entity (id, name, garments, occasion, season, rating, notes, createdAt)
- [x] `UserProfile` entity (id, name, bodyMeasurements, stylePreferences, colorPalette)
- [x] `StyleRule` entity (id, name, conditions, recommendations, priority)
- [x] `WardrobeCollection` entity (id, name, garments, description)
- [x] `CalendarEvent` entity (id, title, date, occasion, dressCode, suggestedOutfits)
- [x] `Wardrobe` aggregate root (unique garments, no dangling collection references)

### P0 - Value Objects
- [x] `Color` value object (hex, rgb, hsl, name, category, season)
- [x] `Size` value object (system, value, measurements)
- [x] `Season` enum (Spring, Summer, Autumn, Winter, AllSeason)
- [x] `Occasion` enum (Casual, Business, Formal, Sport, Party, Date, etc.)
- [x] `GarmentCategory` enum (Tops, Bottoms, Dresses, Outerwear, Shoes, Accessories)
- [x] `GarmentSubcategory` enums per category
- [x] `BodyMeasurements` value object
- [x] `StylePreference` value object
- [x] `WeatherCondition` value object
- [x] `ColorPalette` value object (primary, secondary, accent, neutral)

### P0 - Repository Interfaces
- [x] `IGarmentRepository` (CRUD + query methods)
- [x] `IOutfitRepository` (CRUD + query methods)
- [x] `IUserProfileRepository`
- [x] `IStyleRuleRepository`
- [x] `ICollectionRepository`
- [x] `ICalendarEventRepository`

### P1 - Domain Services
- [x] `ColorHarmonyService` (complementary, analogous, triadic analysis)
- [x] `StyleCompatibilityService` (garment pairing rules)
- [x] `SeasonalRecommendationService`
- [x] `OccasionMatchingService`
- [x] `OutfitScoringService` (rate outfit combinations 0–100 across ten weighted factors + smart rules)

### P1 - Application Layer (Use Cases / CQRS)
- [x] **Commands**: AddGarment, UpdateGarment, RemoveGarment, CreateOutfit, RateOutfit
- [x] **Commands**: UpdateProfile, SetPreferences, CreateCollection
- [x] **Queries**: GetWardrobe, GetOutfitSuggestions, GetGarmentsByCategory
- [x] **Queries**: GetStyleAnalysis, GetColorPalette, GetSeasonalWardrobe
- [x] Command/Query bus implementation (pure in-memory `MessageBus`/`CommandBus`/`QueryBus`)
- [x] Use case validation middleware

---

## Phase 3: Infrastructure Package (`packages/infrastructure`)

### P0 - Database Layer
- [ ] Set up SQLite with better-sqlite3
- [ ] Configure Drizzle ORM schema definitions
- [ ] Create migration system
- [ ] Implement `GarmentRepository` (SQLite)
- [ ] Implement `OutfitRepository` (SQLite)
- [ ] Implement `UserProfileRepository` (SQLite)
- [ ] Implement `StyleRuleRepository` (SQLite)
- [ ] Implement `CollectionRepository` (SQLite)
- [ ] Create database seeding scripts (demo data)

### P0 - Vector Database
- [ ] Set up ChromaDB embedded instance
- [ ] Define embedding schemas for garments
- [ ] Implement vector search for similar items
- [ ] Implement style embedding generation
- [ ] Create vector indexing pipeline

### P1 - Image Processing
- [ ] Implement Sharp-based image pipeline
- [ ] Background removal service
- [ ] Color extraction from garment images
- [ ] Image resizing and thumbnail generation
- [ ] Image metadata extraction (EXIF)
- [ ] Garment category detection preprocessing

### P1 - File Storage
- [ ] Implement local file storage service
- [ ] Image file management (save, retrieve, delete)
- [ ] Storage path configuration
- [ ] File naming and organization strategy
- [ ] Storage cleanup and garbage collection

### P2 - External Service Adapters
- [ ] Weather API adapter (OpenWeatherMap or similar)
- [ ] Calendar sync adapter (Google Calendar, Outlook)
- [ ] Cloud storage adapter (optional backup)

---

## Phase 4: Desktop Application (`apps/desktop`)

### P0 - Electron Main Process
- [ ] Configure Electron main entry point
- [ ] Implement window creation and management
- [ ] Set up IPC (Inter-Process Communication) channels
- [ ] Implement app lifecycle (startup, shutdown, tray)
- [ ] Configure auto-updater (electron-updater)
- [ ] Set up native file dialogs (image import)
- [ ] Implement deep linking / protocol handler
- [ ] Configure app security (CSP, node integration)

### P0 - Embedded Backend (Fastify)
- [ ] Initialize Fastify server in main process
- [ ] Define API route structure
- [ ] Implement garment CRUD endpoints
- [ ] Implement outfit CRUD endpoints
- [ ] Implement user profile endpoints
- [ ] Implement AI recommendation endpoint
- [ ] Implement image upload/processing endpoint
- [ ] Add request validation (Zod schemas)
- [ ] Add error handling middleware
- [ ] Implement WebSocket for real-time updates

### P0 - Frontend Shell (React)
- [ ] Set up React 18 with TypeScript
- [ ] Configure React Router for navigation
- [ ] Set up Zustand store architecture
- [ ] Initialize Shadcn/ui component library
- [ ] Configure Tailwind CSS with custom theme
- [ ] Create app layout (sidebar, header, main content)
- [ ] Implement responsive design system
- [ ] Set up dark/light theme switching

### P1 - Frontend Pages & Features
- [ ] **Dashboard**: Overview, quick actions, recent outfits, weather widget
- [ ] **Wardrobe**: Grid/list view, filters, search, bulk actions
- [ ] **Garment Detail**: Image gallery, metadata editor, related items
- [ ] **Add Garment**: Image upload, auto-categorization, manual entry
- [ ] **Outfit Builder**: Drag-and-drop garment combination
- [ ] **Outfit Suggestions**: AI-generated recommendations
- [ ] **Virtual Try-On**: 3D avatar with garment overlay
- [ ] **Profile/Settings**: User preferences, AI settings, storage
- [ ] **Calendar**: Event management, outfit planning
- [ ] **Analytics**: Wardrobe stats, style insights, usage patterns
- [ ] **Plugin Manager**: Browse, install, configure plugins

### P1 - State Management (Zustand)
- [ ] Wardrobe store (garments, collections, filters)
- [ ] Outfit store (outfits, suggestions, history)
- [ ] User store (profile, preferences, settings)
- [ ] UI store (theme, layout, notifications)
- [ ] AI store (model status, generation state)
- [ ] Implement store persistence (localStorage/SQLite)
- [ ] Implement optimistic updates

### P2 - UI Components (Shadcn/ui + Custom)
- [ ] GarmentCard component (thumbnail, info, actions)
- [ ] OutfitPreview component (layered garment display)
- [ ] ColorSwatch component (interactive color picker)
- [ ] ImageUploader component (drag-drop, crop, preview)
- [ ] FilterPanel component (multi-criteria filtering)
- [ ] TagInput component (autocomplete, create new)
- [ ] WeatherWidget component
- [ ] NotificationToast component
- [ ] LoadingSkeleton components
- [ ] EmptyState components

---

## Phase 5: AI Engine Integration

### P0 - LangChain.js Setup
- [ ] Configure LangChain.js with multiple providers
- [ ] Implement model abstraction layer
- [ ] Create prompt templates for fashion analysis
- [ ] Implement output parsers for structured responses
- [ ] Set up conversation memory for context

### P0 - Ollama Integration (Local AI)
- [ ] Detect Ollama installation and available models
- [ ] Implement model download/management UI
- [ ] Create local inference service
- [ ] Implement streaming responses
- [ ] Handle model loading/unloading for memory management

### P1 - Cloud AI Integration
- [ ] OpenAI API connector (GPT-4 Vision for image analysis)
- [ ] Anthropic API connector (Claude for text reasoning)
- [ ] API key management and secure storage
- [ ] Rate limiting and cost tracking
- [ ] Fallback chain (local -> cloud)

### P1 - AI Pipelines
- [ ] Garment analysis pipeline (image -> attributes)
- [ ] Style recommendation chain (profile + wardrobe -> outfits)
- [ ] Color harmony analysis chain
- [ ] Occasion-appropriate outfit chain
- [ ] Natural language wardrobe search
- [ ] Style transfer suggestions ("Dress like [celebrity/style]")

### P2 - AI Features
- [ ] Outfit explanation (why this combination works)
- [ ] Shopping recommendations (wardrobe gaps)
- [ ] Trend analysis and suggestions
- [ ] Personal style evolution tracking
- [ ] Conversational style assistant (chat interface)

---

## Phase 6: Virtual Try-On (Three.js)

### P1 - 3D Avatar System
- [ ] Set up React Three Fiber renderer
- [ ] Create parametric body model
- [ ] Implement body measurement customization
- [ ] Add pose presets (standing, walking, sitting)
- [ ] Implement camera controls (orbit, zoom)

### P1 - Garment Rendering
- [ ] 2D garment overlay on 3D model
- [ ] Garment positioning and scaling
- [ ] Layer ordering (underwear -> outer)
- [ ] Color/texture mapping
- [ ] Basic physics simulation (draping)

### P2 - Advanced Features
- [ ] Multiple angle views
- [ ] Screenshot/export functionality
- [ ] Animation (turntable rotation)
- [ ] Light/shadow for realism
- [ ] AR preview (future - mobile companion)

---

## Phase 7: Plugin System (`packages/plugin-sdk`)

### P1 - Plugin SDK
- [ ] Define plugin manifest schema (name, version, permissions)
- [ ] Create plugin API surface (read wardrobe, suggest outfits, etc.)
- [ ] Implement plugin lifecycle hooks (install, activate, deactivate, uninstall)
- [ ] Create TypeScript types for plugin developers
- [ ] Build plugin development CLI tool

### P1 - Plugin Runtime
- [ ] Implement Worker Thread sandbox
- [ ] Create message passing protocol (main <-> plugin)
- [ ] Implement permission system (file access, network, etc.)
- [ ] Add resource limits (CPU, memory, execution time)
- [ ] Implement plugin state persistence

### P2 - Plugin Ecosystem
- [ ] Create plugin template/boilerplate
- [ ] Build plugin marketplace UI (local directory)
- [ ] Write sample plugins:
  - [ ] Color palette generator plugin
  - [ ] Instagram style import plugin
  - [ ] Laundry tracker plugin
  - [ ] Packing list generator plugin
- [ ] Plugin documentation and developer guide

---

## Phase 8: Polish, Testing & Distribution

### P1 - Testing
- [ ] Unit tests for domain entities and services (>80% coverage)
- [ ] Unit tests for infrastructure repositories
- [ ] Integration tests for API endpoints
- [ ] Integration tests for AI pipelines (mocked)
- [ ] E2E tests for critical user flows (Playwright)
- [ ] Visual regression tests for UI components
- [ ] Performance benchmarks

### P1 - Performance
- [ ] Implement lazy loading for images
- [ ] Add virtualized lists for large wardrobes
- [ ] Optimize SQLite queries with indices
- [ ] Implement service worker for caching
- [ ] Profile and optimize memory usage
- [ ] Reduce Electron bundle size

### P2 - Accessibility & i18n
- [ ] WCAG 2.1 AA compliance audit
- [ ] Keyboard navigation support
- [ ] Screen reader announcements
- [ ] High contrast theme
- [ ] i18n setup (English, Spanish initially)
- [ ] RTL language support preparation

### P2 - Distribution
- [ ] Configure electron-builder for Windows
- [ ] Create NSIS installer
- [ ] Implement auto-update (electron-updater + GitHub Releases)
- [ ] Code signing certificate setup
- [ ] Create portable version (no install)
- [ ] Write installation documentation

### P3 - Documentation
- [ ] API documentation (internal Fastify routes)
- [ ] Plugin SDK developer guide
- [ ] User manual / help system
- [ ] Architecture documentation (C4 diagrams)
- [ ] Contributing guide

---

## Backlog (Future Considerations)

- [ ] Mobile companion app (React Native)
- [ ] Cloud sync between devices
- [ ] Social features (share outfits, get feedback)
- [ ] Integration with e-commerce (shopping links)
- [ ] Sustainability scoring (ethical fashion)
- [ ] Garment care reminders (washing, dry cleaning)
- [ ] Seasonal wardrobe rotation reminders
- [ ] Outfit history and repeat detection
- [ ] Multi-user support (family wardrobes)
- [ ] Voice assistant integration

---

*Last updated: 2026-06-29*
