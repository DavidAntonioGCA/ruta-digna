"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ClipboardList, MapPin, Activity, Settings2 } from "lucide-react"

const navItems = [
  { href: "/antes-de-ir", icon: ClipboardList, label: "Preparación" },
  { href: "/recomendar",  icon: MapPin,         label: "Mi clínica"  },
  { href: "/tracking",    icon: Activity,       label: "Mi visita"   },
  { href: "/ajustes",     icon: Settings2,      label: "Ajustes"     },
]

export default function BottomNav() {
  const pathname = usePathname()
  if (pathname === "/login") return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-[#E2E8F0] z-50">
      <div className="flex items-center justify-around h-full max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 px-3 py-2"
            >
              <Icon 
                className={`w-5 h-5 ${isActive ? "text-primary" : "text-muted"}`} 
              />
              <span 
                className={`text-xs font-medium ${isActive ? "text-primary" : "text-muted"}`}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
