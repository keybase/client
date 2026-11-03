// The devices list as the app shows it and the app's own revoke (Devices > the device > Revoke >
// confirm). The service-side reads and the revoke checks are the shared ones.
import {expect, type Page} from '@playwright/test'
import escapeRegExp from 'lodash/escapeRegExp'
import * as T from '@/tests/e2e/shared/test-ids'
import {navigateToDevices} from './navigate'

export {deviceHistory, listedDevices, mainDevice, requireRevocableFromHost} from '@/tests/e2e/shared/devices'

// The devices list's row for `name`, exactly (a revoked one says "Revoked ..." in it).
const deviceRow = (page: Page, name: string) =>
  page.getByTestId(T.DEVICES_ROW).filter({has: page.getByText(name, {exact: true})})

type ScrollDom = {
  document: {querySelector: (q: string) => {querySelectorAll: (q: string) => ArrayLike<ScrollEl>} | null}
  getComputedStyle: (e: ScrollEl) => {overflowY: string}
}
type ScrollEl = {scrollTop: number; scrollHeight: number; clientHeight: number}

// Scrolls the devices list (virtualized: only rows near the viewport exist) from its top, a screen at
// a time, until `name`'s row is there; undefined when no row has it. The account has hundreds of
// devices.
export const findDeviceRow = async (page: Page, name: string) => {
  const row = deviceRow(page, name)
  for (let i = 0, moved = true; moved && i < 200; i++) {
    if (await row.count()) {
      await row.scrollIntoViewIfNeeded()
      return row
    }
    moved = await page.evaluate(
      ([list, first]) => {
        const g = globalThis as unknown as ScrollDom
        const root = g.document.querySelector(`[data-testid="${list}"]`)
        const el = Array.from(root?.querySelectorAll('*') ?? []).find(
          e => e.scrollHeight > e.clientHeight + 1 && /auto|scroll/.test(g.getComputedStyle(e).overflowY)
        )
        if (!el) return false
        if (first) {
          el.scrollTop = 0
          return true
        }
        const before = el.scrollTop
        el.scrollTop = before + el.clientHeight
        return el.scrollTop !== before
      },
      [T.DEVICES_LIST, i === 0] as const
    )
    // the list renders the rows for the new offset on its next frame
    await page.waitForTimeout(150)
  }
  return (await row.count()) ? row : undefined
}

export const scrollToDeviceRow = async (page: Page, name: string) => {
  const row = await findDeviceRow(page, name)
  if (!row) throw new Error(`no row for ${name} anywhere in the devices list`)
  return row
}

// The devices header's "<n> Active • <m> Revoked", once the list has loaded (it shows 0 of each
// until then; the account always has the main service's device).
export const deviceCounts = async (page: Page) => {
  await expect(page.getByTestId(T.DEVICES_ROW).first()).toBeVisible({timeout: 15_000})
  const header = page.getByText(/^\d+ Active • \d+ Revoked$/).locator('visible=true')
  await expect(header).not.toHaveText(/^0 Active/, {timeout: 15_000})
  const [active, revoked] = ((await header.innerText()).match(/\d+/g) ?? []).map(Number)
  if (active === undefined || revoked === undefined) throw new Error('the devices header gave no counts')
  return {active, revoked}
}

// Devices > `name`'s row > Revoke this <kind>; the confirm screen must name it before `beforeConfirm`
// (a step) and the confirm. Ends back on the devices list.
export const revokeInApp = async (page: Page, name: string, kind: 'computer' | 'paper key', beforeConfirm: () => Promise<void>) => {
  await navigateToDevices(page)
  const row = await scrollToDeviceRow(page, name)
  await expect(row).toHaveCount(1, {timeout: 15_000})
  await row.click()
  const devicePage = page.getByTestId(T.DEVICE_PAGE).locator('visible=true')
  await expect(devicePage).toBeVisible({timeout: 10_000})
  await devicePage.getByText(`Revoke this ${kind}`, {exact: true}).click()
  const confirm = page.getByText('Yes, delete it', {exact: true}).locator('visible=true')
  await expect(confirm).toBeVisible({timeout: 10_000})
  await expect(page.getByText(new RegExp(`^Are you sure you want to revoke\\s+${escapeRegExp(name)}\\?`)).locator('visible=true')).toBeVisible()
  await beforeConfirm()
  await confirm.click()
  await expect(confirm).toHaveCount(0, {timeout: 30_000})
}


// After the app revoked `name`: one fewer active device and one more revoked in the header, and no
// row shows it as active (the revoked section, when open, lists it as "Revoked ...").
export const expectRevokedInList = async (page: Page, name: string, before: {active: number; revoked: number}) => {
  await navigateToDevices(page)
  await expect.poll(async () => deviceCounts(page), {timeout: 30_000}).toEqual({active: before.active - 1, revoked: before.revoked + 1})
  const row = await findDeviceRow(page, name)
  if (row) await expect(row).toContainText('Revoked')
}
