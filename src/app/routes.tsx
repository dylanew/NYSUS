import type { RouteObject } from 'react-router'
import { AppLayout } from '../components/layout/AppLayout'
import { RouteError } from '../components/layout/RouteError'
import { PageLoading } from '../components/layout/PageLoading'
import { HomePage } from '../pages/HomePage'
import { PlaceholderPage } from '../pages/PlaceholderPage'

/**
 * Home loads with the shell; other pages load on first visit, so charts (Recharts) and the
 * player don't weigh down the first screen. The layout shows a progress bar meanwhile.
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteError />,
    hydrateFallbackElement: <PageLoading />,
    children: [
      {
        errorElement: <RouteError inline />,
        children: [
          { index: true, element: <HomePage /> },
          { path: 'discover', lazy: async () => ({ Component: (await import('../pages/DiscoverPage')).DiscoverPage }) },
          { path: 'watchlist', lazy: async () => ({ Component: (await import('../pages/WatchlistPage')).WatchlistPage }) },
          { path: 'title/:id', lazy: async () => ({ Component: (await import('../pages/TitlePage')).TitlePage }) },
          { path: 'player', lazy: async () => ({ Component: (await import('../pages/PlayerPage')).PlayerPage }) },
          { path: 'health', lazy: async () => ({ Component: (await import('../pages/StreamHealthPage')).StreamHealthPage }) },
          { path: 'assistant', lazy: async () => ({ Component: (await import('../pages/AssistantPage')).AssistantPage }) },
          { path: 'settings', lazy: async () => ({ Component: (await import('../pages/SettingsPage')).SettingsPage }) },
          { path: '*', element: <PlaceholderPage title="Not found" /> },
        ],
      },
    ],
  },
]
