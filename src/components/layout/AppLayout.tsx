import { NavLink, Outlet } from 'react-router'
import { NAV_ITEMS } from './navItems'
import { Wordmark } from './Wordmark'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex shrink-0 items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors ${
    isActive ? 'bg-accent-500/15 text-ink-100 shadow-[inset_3px_0_0_var(--color-accent-500)]' : 'text-ink-300 hover:bg-ink-850 hover:text-ink-100'
  }`

export function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <div aria-hidden className="popcorn-stripes h-1.5 shrink-0" />
      <div className="flex flex-1">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-ink-800 bg-ink-900 px-4 py-6 md:flex">
          <Wordmark className="px-3" />
          <nav aria-label="Main" className="mt-10 flex flex-col gap-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} end={to === '/'} className={linkClass}>
                <Icon className="size-4" aria-hidden />
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-ink-800 px-4 py-3 md:hidden">
            <Wordmark />
          </header>
          <nav aria-label="Mobile" className="flex gap-1 overflow-x-auto border-b border-ink-800 px-2 py-2 md:hidden">
            {NAV_ITEMS.map(({ to, label }) => (
              <NavLink key={to} to={to} end={to === '/'} className={linkClass}>
                {label}
              </NavLink>
            ))}
          </nav>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-10 md:py-12">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
