import {
  KeyRound,
  LayoutDashboard,
  QrCode,
  Settings,
  ShieldPlus,
  Stethoscope,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Extra path prefixes that should highlight this item. */
  match?: string[];
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/personnel", label: "Personnel", icon: Users },
  { href: "/register/soldier", label: "Register Soldier", icon: UserPlus },
  { href: "/register/staff", label: "Register Medic / Doctor", icon: Stethoscope },
  { href: "/teams", label: "Medical Teams", icon: ShieldPlus },
  { href: "/qr", label: "QR Management", icon: QrCode },
  { href: "/roles", label: "Roles & Access", icon: KeyRound },
  { href: "/settings", label: "Settings", icon: Settings },
];
