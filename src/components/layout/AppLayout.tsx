import { useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation, useNavigation } from 'react-router'
import { NAV_ITEMS } from './navItems'
import { Wordmark } from './Wordmark'
import { AssistantDrawer } from '../assistant/AssistantDrawer'
import { AccountMenu } from '../account/AccountMenu'
import { NavigationProgress } from './PageLoading'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `relative flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors ${
    isActive
      ? 'bg-accent-500/15 text-ink-100 after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-accent-500'
      : 'text-ink-300 hover:bg-ink-850 hover:text-ink-100'
  }`

export function AppLayout() {
  const navRef = useRef<HTMLElement>(null)
  const { pathname } = useLocation()
  const navigation = useNavigation()

  // On narrow screens the nav row scrolls sideways; keep the current page's tab in view.
  useEffect(() => {
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [pathname])

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-ink-800 bg-ink-900/95 backdrop-blur">
        <div aria-hidden className="popcorn-stripes h-1.5" />
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-8 gap-y-1 px-2 py-2 lg:flex-nowrap lg:px-6">
          <Wordmark className="order-1 px-2 py-1 lg:px-0" />
          <div className="order-2 ml-auto pr-2 lg:order-3 lg:pr-0">
            <AccountMenu />
          </div>
          <nav ref={navRef} aria-label="Main" className="order-3 -mx-2 flex w-[calc(100%+1rem)] gap-1 overflow-x-auto px-2 [scrollbar-width:none] lg:order-2 lg:mx-0 lg:w-auto lg:min-w-0 lg:px-0">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} end={to === '/'} className={linkClass}>
                <Icon className="size-4" aria-hidden />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
        <NavigationProgress active={navigation.state === 'loading'} />
      </header>
      <div className="flex flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-10 md:py-12">
            <Outlet />
          </main>
        </div>
      </div>
      <AssistantDrawer />
    </div>
  )
}
