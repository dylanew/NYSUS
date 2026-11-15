import type { RouteObject } from 'react-router'
import { AppLayout } from '../components/layout/AppLayout'
import { HomePage } from '../pages/HomePage'
import { SettingsPage } from '../pages/SettingsPage'
import { PlaceholderPage } from '../pages/PlaceholderPage'
import { DiscoverPage } from '../pages/DiscoverPage'
import { WatchlistPage } from '../pages/WatchlistPage'
import { TitlePage } from '../pages/TitlePage'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'discover', element: <DiscoverPage /> },
      { path: 'watchlist', element: <WatchlistPage /> },
      { path: 'title/:id', element: <TitlePage /> },
      { path: 'player', element: <PlaceholderPage title="Player" phase={3} /> },
      { path: 'health', element: <PlaceholderPage title="Stream Health" phase={3} /> },
      { path: 'assistant', element: <PlaceholderPage title="AI Assistant" phase={4} /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <PlaceholderPage title="Not found" /> },
    ],
  },
]
