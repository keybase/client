import {expect, type Page} from '@playwright/test'
import {checkRendererAfterReload} from './connect'
import {keepBeforeReload} from '@/tests/e2e/shared/recorder'

// Reloads the renderer within a test, keeping what the page recorded before it for the test's
// coverage (see keepBeforeReload).
export const reloadKeepingCoverage = async (page: Page) => {
  await keepBeforeReload(page)
  await checkRendererAfterReload(page)
}

// Whether what a flow changed survives a reload of the app: reloads the renderer (dropping its
// in-memory state), then `read`, which navigates back to where the value shows and reads it.
export const expectPersists = async <T,>(page: Page, read: () => Promise<T>, expected: T, what: string): Promise<void> => {
  await reloadKeepingCoverage(page)
  const got: unknown = await read()
  expect(got, `${what} after a reload`).toEqual(expected)
}
