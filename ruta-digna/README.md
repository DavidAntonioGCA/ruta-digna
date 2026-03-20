# Ruta Digna
**Tu camino en la clínica, paso a paso.**
Hackathon Talent Land 2026 · Track Salud Digna · Equipo Last Dance RSCO

---

## Roles

| Persona | Carpeta | Stack |
|---|---|---|
| Arturo | `frontend/` | Next.js 14 + Tailwind |
| Adrián | `backend/` | FastAPI + Claude API |
| Juan Diego | `dashboard/` | React 18 + Vite + Chart.js |
| David | `frontend/` + Figma | UX + Pitch + QA |

---

## Setup en 5 minutos

### Requisitos
- Node.js 18+, Python 3.10+, Git

### 1. Clonar
```bash
git clone <URL_DEL_REPO>
cd ruta-digna
```

### 2. Backend (Adrián — puerto 4000)
```bash
cd backend
cp .env.example .env        # Pedir credenciales a David
python -m venv venv
source venv/bin/activate    # Mac/Linux
venv\Scripts\activate       # Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 4000
# Verificar: http://localhost:4000/health → {"status":"ok"}
# Docs:      http://localhost:4000/docs
```

### 3. Frontend (Arturo — puerto 3000)
```bash
cd frontend
cp .env.example .env.local  # Pedir URL del backend a Adrián
npm install
npm run dev
```

### 4. Dashboard (Juan Diego — puerto 3001)
```bash
cd dashboard
cp .env.example .env.local
npm install
npm run dev
```

---

## Datos de prueba en Supabase ✓

```
visita_id:  06b8efbf-67bc-426c-9523-3059d0dec059
paciente:   María González
estudios:   1→LABORATORIO (actual) | 2→ULTRASONIDO (pendiente)
sucursal:   Culiacán (id=1)
```

Verificar en cualquier momento:
```sql
SELECT fn_obtener_estado_visita('06b8efbf-67bc-426c-9523-3059d0dec059');
```

---

## Flujo de Git

```bash
# Cada quien trabaja en su rama
git checkout -b persona-1   # o persona-2, persona-3

# Commit atómico por funcionalidad
git add .
git commit -m "feat: add tracking stepper component"
git push origin persona-1

# Merge a main cada ~4 horas — David coordina
```

**Regla de oro:** Adrián hace merge primero siempre.
Si `/health` está verde, todos pueden conectar.

---

## Puertos

| Servicio | URL |
|---|---|
| Backend API | http://localhost:4000 |
| Docs API | http://localhost:4000/docs |
| Frontend | http://localhost:3000 |
| Dashboard | http://localhost:3001 |
