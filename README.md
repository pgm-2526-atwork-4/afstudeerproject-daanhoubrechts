# KotHub

Een webapplicatie om **studentenkoten en kotgroepen** te organiseren: praktische kotinfo, een muur met berichten en polls, meldingen, gedeelde taken, een kotkas en instellingen. **Kotbaas** en **kotgenoot** hebben verschillende rechten binnen een groep.

**Live:** [kothub.netlify.app](https://kothub.netlify.app/)  
**Repository:** [pgm-2526-atwork-4/afstudeerproject-daanhoubrechts](https://github.com/pgm-2526-atwork-4/afstudeerproject-daanhoubrechts)

## Ontwikkelaars

Dit project is ontwikkeld door:

- Daan Houbrechts

(Afstudeerproject @Work4, PGM Arteveldehogeschool.)

## Gebruikte technologieën

### Backend

- **Node.js** — server runtime
- **Express.js** — web framework en REST API (`/api`)
- **TypeScript** — type-safe server code
- **Supabase** — database en auth
- **multer** — file uploads (o.a. documenten / afbeeldingen)
- **cors** — cross-origin requests voor de Angular app
- **dotenv** — environment variables uit `.env`

### Frontend

- **Angular 21** — SPA met standalone components en signals
- **Tailwind CSS 4** — styling
- **Lucide Angular** — icons

## Projectstructuur

```
afstudeerproject-daanhoubrechts/
├── frontend/
│   ├── public/                 # static assets
│   └── src/
│       ├── app/
│       │   ├── auth/           # login, registratie
│       │   ├── components/     # reusable UI
│       │   ├── core/           # o.a. auth, HTTP interceptor
│       │   ├── models/         # TypeScript interfaces
│       │   ├── pages/          # routable pages
│       │   ├── pipes/
│       │   ├── utils/
│       │   ├── app.routes.ts
│       │   └── app.config.ts
│       └── environments/
└── backend/
    └── src/
        ├── lib/                # Supabase client
        ├── middleware/         # o.a. auth middleware
        ├── routes/             # API route modules
        └── index.ts            # Express entrypoint
```

## Installatie en setup

### Vereisten

- **Node.js** en **npm** (zie `packageManager` / lockfiles in de subprojecten)
- Een **Supabase-project** en keys in `.env` (zie `backend/.env.example`)

### Stappen

**1. Repository clonen**

```bash
git clone https://github.com/pgm-2526-atwork-4/afstudeerproject-daanhoubrechts.git
cd afstudeerproject-daanhoubrechts
```

**2. Backend**

```bash
cd backend
cp .env.example .env
```

Vul `.env` aan de hand van `.env.example` (minimaal Supabase URL en anon key).

```bash
npm install
npm run dev
```

De API luistert op `http://localhost:4000`, routes onder **`/api`**.

**3. Frontend** (tweede terminal)

```bash
cd frontend
npm install
ng serve
```

Zonder globale Angular CLI: `npx ng serve`.  
App: [http://localhost:4200](http://localhost:4200).

## Logins

Voor testen van de applicatie zijn er voorbeeldaccounts (kotbaas vs. kotgenoot):

| Rol       | E-mail                                      | Wachtwoord                |
| --------- | ------------------------------------------- | ------------------------- |
| Kotbaas   | `kotbaas.voorbeeld@student.hogeschool.be`   | `VoorbeeldWachtwoord123!` |
| Kotgenoot | `kotgenoot.voorbeeld@student.hogeschool.be` | `AndersVoorbeeld456!`     |

## Functionaliteiten

- **Authenticatie:** registratie, login, protected routes, token refresh via API
- **Kotgroepen:** overzicht, aanmaken, lid worden (o.a. via join/invite flow)
- **Kotinfo:** praktische info per kot, tabs voor o.a. leden, regels, wifi, contract
- **Posts:** berichten, reacties, polls
- **Issues:** meldingen opvolgen met status
- **Todos:** gedeelde taken per kotgroep
- **KotKas:** uitgaven, saldi en afrekenen tussen kotgenoten
- **Dashboard:** overzicht na aanmelden
- **Instellingen:** profiel en voorkeuren
- **Responsive UI:** gebruik op desktop en mobiel

## Scripts

| Locatie     | Commando        | Beschrijving             |
| ----------- | --------------- | ------------------------ |
| `backend/`  | `npm run dev`   | API met hot reload (tsx) |
| `backend/`  | `npm run build` | TypeScript → `dist/`     |
| `backend/`  | `npm start`     | compiled app (`node`)    |
| `frontend/` | `ng serve`      | Development server       |
| `frontend/` | `npm run build` | production build         |

## Database

Data en login lopen via **Supabase**; de Express API gebruikt de Supabase client voor **read/write**.
