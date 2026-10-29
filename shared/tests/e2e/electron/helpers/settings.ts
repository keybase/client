// Settings pages and their controls, read the way a person sees them, for the flows that set a
// value in the app and read it back from the service.
import {expect, type Locator, type Page} from '@playwright/test'
import * as T from '@/tests/e2e/shared/test-ids'
import {navigateToSettings} from './navigate'
import {checkMarkShown} from './teams'

export const settingsPage = (page: Page, testID: string) => page.getByTestId(testID).locator('visible=true')

const openSettingsPage = async (page: Page, nav: string, testID: string) => {
  await navigateToSettings(page)
  await page.getByTestId(T.SETTINGS_ACCOUNT).locator(`text=${nav}`).first().click()
  await expect(settingsPage(page, testID), `the ${nav} settings page`).toBeVisible({timeout: 15_000})
}

export const openChat = async (page: Page) => openSettingsPage(page, 'Chat', T.SETTINGS_CHAT)
export const openDisplay = async (page: Page) => openSettingsPage(page, 'Display', T.SETTINGS_DISPLAY)
export const openAdvanced = async (page: Page) => openSettingsPage(page, 'Advanced', T.SETTINGS_ADVANCED)
export const openNotifications = async (page: Page) => openSettingsPage(page, 'Notifications', T.SETTINGS_NOTIFICATIONS)

// The checkbox labelled `label` in `within`: the innermost element holding both the label and a check
// mark, which an unchecked box hides.
const checkbox = (within: Locator, label: string) =>
  within
    .locator('div')
    .filter({has: within.page().getByText(label, {exact: true})})
    .filter({has: within.page().locator('.icon-gen-iconfont-check')})
    .last()
export const isChecked = async (within: Locator, label: string) => {
  const box = checkbox(within, label)
  await expect(box, `the checkbox "${label}"`).toBeVisible({timeout: 15_000})
  return checkMarkShown(box.locator('.icon-gen-iconfont-check').first())
}
export const clickCheckbox = async (within: Locator, label: string) => {
  await within.getByText(label, {exact: true}).click()
}

// The radio button labelled `label` in `within`, and whether it is the selected one.
export const radio = (within: Locator, label: string) =>
  within
    .locator('div')
    .filter({has: within.page().getByText(label, {exact: true})})
    .filter({has: within.page().locator('.radio-button')})
    .last()
const isSelected = async (within: Locator, label: string) => {
  const button = radio(within, label).locator('.radio-button').first()
  await expect(button, `the radio button "${label}"`).toBeVisible({timeout: 15_000})
  return /\bselected\b/.test((await button.getAttribute('class')) ?? '')
}
// The label of the one selected radio button among `labels`, once one is: none is while the value
// loads.
export const selectedOf = async (within: Locator, labels: ReadonlyArray<string>) => {
  let on: Array<string> = []
  await expect
    .poll(
      async () => {
        on = []
        for (const l of labels) if (await isSelected(within, l)) on.push(l)
        return on.length
      },
      {message: `one of ${labels.join(', ')} selected`, timeout: 15_000}
    )
    .toBe(1)
  return on[0] ?? ''
}

// What the app shows, once it shows what the service holds: a value still loading shows a default.
// Gives the last thing shown when it never does, which the caller's check then fails on.
export const shownOnceLoaded = async <V,>(shown: () => Promise<V>, service: () => Promise<V>, what: string): Promise<V> => {
  let got = await shown()
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    if (JSON.stringify(got) === JSON.stringify(await service())) return got
    await new Promise(resolve => setTimeout(resolve, 250))
    got = await shown()
  }
  console.log(`${what}: the app shows ${JSON.stringify(got)}, not what the service holds, after 15s`)
  return got
}

// Opens a settings page, then reads what it shows.
export const openThen = async <V,>(page: Page, open: (page: Page) => Promise<void>, read: () => V | Promise<V>) => {
  await open(page)
  return read()
}

// Polls `read` until it gives `want`.
export const serviceSays = async <V,>(read: () => Promise<V>, want: V, what: string, timeout = 20_000) =>
  expect.poll(read, {message: what, timeout}).toEqual(want)
