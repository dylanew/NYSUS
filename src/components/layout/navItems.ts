import { Bookmark, Compass, HeartPulse, Home, MessageSquare, PlayCircle, Settings, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/discover', label: 'Discover', icon: Compass },
  { to: '/watchlist', label: 'Watchlist', icon: Bookmark },
  { to: '/player', label: 'Player', icon: PlayCircle },
  { to: '/health', label: 'Stream Health', icon: HeartPulse },
  { to: '/assistant', label: 'AI Assistant', icon: MessageSquare },
  { to: '/settings', label: 'Settings', icon: Settings },
]
