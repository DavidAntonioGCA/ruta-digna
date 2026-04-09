"""
Mock de la base de datos de Salud Digna.
Simula el registro histórico de pacientes del sistema nacional.
En producción esto sería una llamada a la API real de Salud Digna.
"""

from datetime import date

# ── Base de datos simulada ─────────────────────────────────────────────
_SD_DB = [
    # Adultos mayores
    {
        "telefono": "6671234567",
        "nombre": "María", "primer_apellido": "González", "segundo_apellido": "López",
        "fecha_nacimiento": "1955-03-12", "sexo": "F",
        "nacionalidad": "Mexicana", "residencia": "Culiacán, Sinaloa",
        "discapacidad": False, "visitas_previas": 3,
    },
    {
        "telefono": "6672345678",
        "nombre": "Roberto", "primer_apellido": "Martínez", "segundo_apellido": "Ruiz",
        "fecha_nacimiento": "1950-07-22", "sexo": "M",
        "nacionalidad": "Mexicano", "residencia": "Culiacán, Sinaloa",
        "discapacidad": False, "visitas_previas": 5,
    },
    {
        "telefono": "6673456789",
        "nombre": "Carmen", "primer_apellido": "Herrera", "segundo_apellido": "Vega",
        "fecha_nacimiento": "1948-11-05", "sexo": "F",
        "nacionalidad": "Mexicana", "residencia": "Mazatlán, Sinaloa",
        "discapacidad": False, "visitas_previas": 8,
    },
    # Con discapacidad
    {
        "telefono": "6674567890",
        "nombre": "Luis", "primer_apellido": "Ramírez", "segundo_apellido": "Torres",
        "fecha_nacimiento": "1985-05-18", "sexo": "M",
        "nacionalidad": "Mexicano", "residencia": "Los Mochis, Sinaloa",
        "discapacidad": True, "visitas_previas": 2,
    },
    {
        "telefono": "6675678901",
        "nombre": "Ana", "primer_apellido": "Soto", "segundo_apellido": "Medina",
        "fecha_nacimiento": "1992-09-30", "sexo": "F",
        "nacionalidad": "Mexicana", "residencia": "Culiacán, Sinaloa",
        "discapacidad": True, "visitas_previas": 1,
    },
    # Mujeres edad fértil (posible embarazo)
    {
        "telefono": "6676789012",
        "nombre": "Sofía", "primer_apellido": "Castillo", "segundo_apellido": "Moreno",
        "fecha_nacimiento": "1998-02-14", "sexo": "F",
        "nacionalidad": "Mexicana", "residencia": "Culiacán, Sinaloa",
        "discapacidad": False, "visitas_previas": 0,
    },
    {
        "telefono": "6677890123",
        "nombre": "Valeria", "primer_apellido": "Flores", "segundo_apellido": "Cruz",
        "fecha_nacimiento": "1995-08-22", "sexo": "F",
        "nacionalidad": "Mexicana", "residencia": "Mazatlán, Sinaloa",
        "discapacidad": False, "visitas_previas": 1,
    },
    # Con cita previa (ya conocidos del sistema)
    {
        "telefono": "6678901234",
        "nombre": "Jorge", "primer_apellido": "Mendoza", "segundo_apellido": "Silva",
        "fecha_nacimiento": "1978-12-01", "sexo": "M",
        "nacionalidad": "Mexicano", "residencia": "Tijuana, Baja California",
        "discapacidad": False, "visitas_previas": 10,
    },
    {
        "telefono": "6679012345",
        "nombre": "Patricia", "primer_apellido": "Jiménez", "segundo_apellido": "Reyes",
        "fecha_nacimiento": "1982-04-17", "sexo": "F",
        "nacionalidad": "Mexicana", "residencia": "Mexicali, Baja California",
        "discapacidad": False, "visitas_previas": 6,
    },
    # Pacientes jóvenes sin historial previo
    {
        "telefono": "6670123456",
        "nombre": "Diego", "primer_apellido": "García", "segundo_apellido": "Ortiz",
        "fecha_nacimiento": "2000-06-25", "sexo": "M",
        "nacionalidad": "Mexicano", "residencia": "Culiacán, Sinaloa",
        "discapacidad": False, "visitas_previas": 0,
    },
    {
        "telefono": "6671112223",
        "nombre": "Isabella", "primer_apellido": "Vargas", "segundo_apellido": "Navarro",
        "fecha_nacimiento": "2001-10-08", "sexo": "F",
        "nacionalidad": "Mexicana", "residencia": "Los Mochis, Sinaloa",
        "discapacidad": False, "visitas_previas": 0,
    },
    # Adulto mayor con discapacidad
    {
        "telefono": "6672223334",
        "nombre": "Eduardo", "primer_apellido": "Delgado", "segundo_apellido": "Ramos",
        "fecha_nacimiento": "1945-01-30", "sexo": "M",
        "nacionalidad": "Mexicano", "residencia": "Mazatlán, Sinaloa",
        "discapacidad": True, "visitas_previas": 15,
    },
    # Extranjero con residencia
    {
        "telefono": "6673334445",
        "nombre": "Carlos", "primer_apellido": "Rodríguez", "segundo_apellido": "Pérez",
        "fecha_nacimiento": "1975-09-11", "sexo": "M",
        "nacionalidad": "Estadounidense", "residencia": "Tijuana, Baja California",
        "discapacidad": False, "visitas_previas": 4,
    },
]


def _calcular_edad(fecha_nacimiento: str) -> int:
    try:
        dob = date.fromisoformat(fecha_nacimiento)
        today = date.today()
        return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    except Exception:
        return 0


def calcular_tipo_paciente(datos: dict, embarazada: bool = False) -> str:
    """
    Determina el tipo de paciente automáticamente a partir de sus datos demográficos.
    Prioridad: discapacidad > adulto_mayor > embarazada > con_cita > sin_cita
    """
    edad = _calcular_edad(datos.get("fecha_nacimiento", ""))
    if datos.get("discapacidad"):
        return "discapacidad"
    if edad >= 60:
        return "adulto_mayor"
    if embarazada:
        return "embarazada"
    if datos.get("visitas_previas", 0) > 0:
        return "con_cita"
    return "sin_cita"


def buscar_en_sd(telefono: str) -> dict | None:
    """Busca un paciente en la base de datos simulada de Salud Digna."""
    for p in _SD_DB:
        if p["telefono"] == telefono:
            return p
    return None


def es_mujer_fertil(datos: dict) -> bool:
    """True si la paciente es mujer en edad fértil (15-50 años)."""
    if datos.get("sexo") != "F":
        return False
    edad = _calcular_edad(datos.get("fecha_nacimiento", ""))
    return 15 <= edad <= 50
