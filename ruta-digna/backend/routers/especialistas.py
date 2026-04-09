"""
Router de autenticación y gestión de especialistas.

Espeja el flujo de pacientes (verificar → registrar → login) pero adaptado
al dashboard: usa id_empleado + PIN en lugar de teléfono, y requiere
seleccionar sucursal y área (id_estudio) obligatoriamente.

Endpoints:
  GET  /especialista/verificar?id_empleado=   → escenario: 'registrado' | 'nuevo'
  POST /especialista/registrar                → crea especialista
  POST /especialista/login                    → valida PIN, retorna sesión
  GET  /especialista/sucursales               → lista de sucursales activas
  GET  /especialista/areas                    → lista de estudios (áreas disponibles)
"""

from fastapi import APIRouter, HTTPException
import uuid as _uuid

try:
    from backend.models.schemas import (
        RegistrarEspecialistaRequest,
        LoginEspecialistaRequest,
        EspecialistaResponse,
    )
    from backend.services.supabase_client import get_supabase
except ImportError:
    from models.schemas import (
        RegistrarEspecialistaRequest,
        LoginEspecialistaRequest,
        EspecialistaResponse,
    )
    from services.supabase_client import get_supabase

router = APIRouter()


# ── Helpers ──────────────────────────────────────────────────────────────────

def _enriquecer(esp: dict, sb) -> dict:
    """Añade nombre_sucursal y nombre_estudio al dict del especialista."""
    suc = sb.table("sucursales").select("nombre").eq("id", esp["id_sucursal"]).single().execute()
    est = sb.table("estudios").select("nombre").eq("id", esp["id_estudio"]).single().execute()
    return {
        **esp,
        "nombre_sucursal": suc.data["nombre"] if suc.data else None,
        "nombre_estudio":  est.data["nombre"]  if est.data else None,
    }


# ── Verificar ────────────────────────────────────────────────────────────────

@router.get("/verificar")
async def verificar_especialista(id_empleado: str):
    """
    Verifica si un número de empleado ya tiene cuenta en el sistema.
    Retorna escenario: 'registrado' | 'nuevo'
    """
    sb = get_supabase()
    try:
        res = (
            sb.table("especialistas")
            .select("id, nombre, id_sucursal, id_estudio, rol")
            .eq("id_empleado", id_empleado.strip())
            .eq("activo", True)
            .execute()
        )
        if res.data:
            esp = res.data[0]
            partes = esp["nombre"].split()
            nombre_mask = (
                f"{partes[0][0]}{'*' * (len(partes[0]) - 1)} "
                f"{partes[-1][0]}{'*' * (len(partes[-1]) - 1)}"
                if len(partes) >= 2 else esp["nombre"]
            )
            return {
                "escenario":      "registrado",
                "nombre_mascara": nombre_mask,
                "rol":            esp["rol"],
            }
        return {"escenario": "nuevo"}
    except Exception as e:
        raise HTTPException(500, str(e))


# ── Registrar ────────────────────────────────────────────────────────────────

@router.post("/registrar", response_model=EspecialistaResponse)
async def registrar_especialista(body: RegistrarEspecialistaRequest):
    """
    Registra un nuevo especialista.
    - id_empleado debe ser único en todo el sistema.
    - Varios especialistas pueden compartir misma sucursal+estudio.
    - PIN: exactamente 4 dígitos numéricos.
    """
    sb = get_supabase()
    try:
        # Verificar que id_empleado no exista ya
        existe = (
            sb.table("especialistas")
            .select("id")
            .eq("id_empleado", body.id_empleado.strip())
            .execute()
        )
        if existe.data:
            raise HTTPException(409, "El número de empleado ya está registrado en el sistema.")

        # Verificar que la sucursal existe y está activa
        suc = (
            sb.table("sucursales")
            .select("id, nombre")
            .eq("id", body.id_sucursal)
            .eq("activa", True)
            .execute()
        )
        if not suc.data:
            raise HTTPException(404, f"Sucursal {body.id_sucursal} no encontrada o inactiva.")

        # Verificar que el estudio/área existe
        est = (
            sb.table("estudios")
            .select("id, nombre")
            .eq("id", body.id_estudio)
            .eq("activo", True)
            .execute()
        )
        if not est.data:
            raise HTTPException(404, f"Área/estudio {body.id_estudio} no encontrado o inactivo.")

        eid = str(_uuid.uuid4())
        sb.table("especialistas").insert({
            "id":          eid,
            "nombre":      body.nombre.strip(),
            "id_empleado": body.id_empleado.strip(),
            "pin":         body.pin,
            "rol":         body.rol,
            "id_sucursal": body.id_sucursal,
            "id_estudio":  body.id_estudio,
            "activo":      True,
        }).execute()

        return EspecialistaResponse(
            especialista_id = eid,
            nombre          = body.nombre.strip(),
            id_empleado     = body.id_empleado.strip(),
            rol             = body.rol,
            id_sucursal     = body.id_sucursal,
            nombre_sucursal = suc.data[0]["nombre"],
            id_estudio      = body.id_estudio,
            nombre_estudio  = est.data[0]["nombre"],
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


# ── Login ────────────────────────────────────────────────────────────────────

@router.post("/login")
async def login_especialista(body: LoginEspecialistaRequest):
    """
    Valida el PIN del especialista y retorna su sesión.
    Respuesta incluye id, nombre, rol, sucursal y área para que el dashboard
    pueda filtrarse automáticamente al área correcta.
    """
    sb = get_supabase()
    try:
        res = (
            sb.table("especialistas")
            .select("id, nombre, pin, rol, id_sucursal, id_estudio")
            .eq("id_empleado", body.id_empleado.strip())
            .eq("activo", True)
            .execute()
        )
        if not res.data:
            raise HTTPException(404, "Número de empleado no encontrado.")

        esp = res.data[0]
        if esp["pin"] != body.pin:
            raise HTTPException(401, "PIN incorrecto.")

        enriquecido = _enriquecer(esp, sb)

        return {
            "especialista_id": esp["id"],
            "nombre":          esp["nombre"],
            "id_empleado":     body.id_empleado.strip(),
            "rol":             esp["rol"],
            "id_sucursal":     esp["id_sucursal"],
            "nombre_sucursal": enriquecido.get("nombre_sucursal"),
            "id_estudio":      esp["id_estudio"],
            "nombre_estudio":  enriquecido.get("nombre_estudio"),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


# ── Catálogos para el formulario de registro ─────────────────────────────────

@router.get("/sucursales")
async def listar_sucursales():
    """Sucursales activas disponibles para asignar al especialista."""
    sb = get_supabase()
    try:
        res = (
            sb.table("sucursales")
            .select("id, nombre, ciudad, estado")
            .eq("activa", True)
            .order("nombre")
            .execute()
        )
        return res.data or []
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/lista")
async def listar_especialistas():
    """Lista todos los especialistas activos con su sucursal y área."""
    sb = get_supabase()
    try:
        res = (
            sb.table("especialistas")
            .select("id, nombre, id_empleado, rol, id_sucursal, id_estudio, activo, created_at")
            .eq("activo", True)
            .order("created_at", desc=True)
            .execute()
        )
        especialistas = res.data or []

        # Enriquecer con nombres de sucursal y estudio
        if especialistas:
            suc_ids = list({e["id_sucursal"] for e in especialistas})
            est_ids = list({e["id_estudio"]  for e in especialistas})

            sucs = sb.table("sucursales").select("id, nombre").in_("id", suc_ids).execute()
            ests = sb.table("estudios").select("id, nombre").in_("id", est_ids).execute()

            sucs_map = {s["id"]: s["nombre"] for s in (sucs.data or [])}
            ests_map = {e["id"]: e["nombre"] for e in (ests.data or [])}

            for e in especialistas:
                e["nombre_sucursal"] = sucs_map.get(e["id_sucursal"])
                e["nombre_estudio"]  = ests_map.get(e["id_estudio"])

        return especialistas
    except Exception as e:
        raise HTTPException(500, str(e))


@router.get("/areas")
async def listar_areas():
    """
    Áreas (estudios) disponibles para asignar al especialista.
    Solo devuelve los activos con nombre y tiempo promedio referencial.
    """
    sb = get_supabase()
    try:
        res = (
            sb.table("estudios")
            .select("id, nombre, tiempo_espera_promedio_min")
            .eq("activo", True)
            .order("nombre")
            .execute()
        )
        return res.data or []
    except Exception as e:
        raise HTTPException(500, str(e))
