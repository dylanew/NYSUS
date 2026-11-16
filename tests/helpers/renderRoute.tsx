import { expect } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { routes } from '../../src/app/routes'

/** Renders the app at a path and waits for that page's lazily loaded code. */
export async function renderRoute(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const view = render(<RouterProvider router={router} />)
  await waitFor(() => expect(router.state.initialized && router.state.navigation.state === 'idle').toBe(true))
  await act(async () => {})
  await waitFor(() => expect(view.container.querySelector('main')).not.toBeNull())
  return { router, ...view }
}
