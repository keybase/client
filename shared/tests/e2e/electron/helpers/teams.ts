// The desktop team pages: a subteam's tabs, the team menu, modals and the role picker. The subteams
// one run's team flows make, the guard on every write to them, and the host read-backs are
// shared/teams.ts's.
import {expect, type Locator, type Page} from '@playwright/test'
import {requireThisRunSubteam} from '@/tests/e2e/shared/teams'
import * as T from '@/tests/e2e/shared/test-ids'
import {openMenu} from './menu'
import {openE2ESubteam} from './navigate'

export {
  addToSubteamFromCli,
  channelMembers,
  conversationInfo,
  deleteSubteamIfPresent,
  freshSubteamPart,
  inviteNames,
  mainRead,
  makeSubteam,
  makeSubteamChannel,
  memberRoles,
  readBack,
  requireThisRunSubteam,
  runChatApi,
  subteamExists,
  teamChannels,
  teamID,
  type ConvInfo,
  type TeamRoleName,
} from '@/tests/e2e/shared/teams'

// Opens one of this run's subteams' tab by its tab button's testID.
export const openSubteamTab = async (page: Page, subteam: string, tabTestID: string) => {
  requireThisRunSubteam(subteam)
  await openE2ESubteam(page, subteam, 'the subteam this test made')
  await page.getByTestId(tabTestID).locator('visible=true').first().click({timeout: 10_000})
}

export const menuItem = (page: Page, title: string) => page.getByTestId(T.FLOATING_MENU).getByText(title, {exact: true})

// Picks `title` from the team page header's menu.
export const pickFromTeamMenu = async (page: Page, title: string) => {
  const item = menuItem(page, title)
  await openMenu(page, page.getByTestId(T.TEAMS_HEADER_MENU_BUTTON).locator('visible=true').first(), item, 'the team menu')
  await item.click()
}

export const modalRoot = (page: Page) => page.locator('#modal-root')

// Zooms the avatar crop of the corpus image e2e-c in the open avatar modal in: wheel turns over
// its frame. No click first: a click in the frame stops the pan and the zoom with it.
export const zoomAvatarCrop = async (page: Page) => {
  const frame = modalRoot(page).locator('img[src*="e2e-c"]').first().locator('xpath=..')
  const box = await frame.boundingBox()
  if (!box) throw new Error('the avatar image is not on screen')
  await page.mouse.move(box.x + box.width / 2 + 10, box.y + box.height / 2 + 10)
  // each turn zooms in 2%
  for (let i = 0; i < 10; i++) await page.mouse.wheel(0, 100)
}

// The open modal's button labelled `label`, the last one drawn (stacked modals draw in order).
export const modalButton = (page: Page, label: string) =>
  modalRoot(page)
    .locator('.button--primary, .button--secondary')
    .filter({has: page.getByText(label, {exact: true})})
    .locator('visible=true')
    .last()

// A ConfirmModal's confirm button, labelled `label`.
export const confirmDanger = async (page: Page, label: string) => {
  await page.locator('.button--type-Danger:visible', {hasText: label}).last().click()
}

// In the open role picker, picks `role` ('Reader', 'Writer', …) and saves it.
export const pickRole = async (page: Page, role: string) => {
  const picker = page.getByTestId(T.TEAMS_ROLE_PICKER).locator('visible=true').last()
  await expect(picker, 'the role picker').toBeVisible({timeout: 10_000})
  await picker.getByText(role, {exact: true}).click()
  await picker.locator('.button--primary', {hasText: 'Save'}).click()
  await expect(picker).toHaveCount(0, {timeout: 10_000})
}

// The page's DOM, as far as the check mark reads below use it (the tests compile without the DOM lib).
type El = {parentElement: El | null; querySelector: (s: string) => El | null; textContent: string | null}
type Win = {getComputedStyle: (e: El) => {opacity: string}}

// The names of the rows of a list of checkboxes (each row a checkbox beside its name) whose box is
// checked: a checked box draws its check mark, an unchecked one hides it (opacity 0).
export const checkedRowNames = async (list: Locator) =>
  list.locator('.icon-gen-iconfont-check').evaluateAll(icons =>
    (icons as unknown as Array<El>)
      .filter(i => (globalThis as unknown as Win).getComputedStyle(i).opacity !== '0')
      .map(i => {
        // the row: the nearest ancestor holding text besides the box
        let el: El | null = i.parentElement
        while (el && !(el.textContent ?? '').trim()) el = el.parentElement
        return (el?.querySelector('.text_BodySemibold')?.textContent ?? el?.textContent ?? '').trim()
      })
  )

// Whether a checkbox's check mark (`.icon-gen-iconfont-check`) shows.
export const checkMarkShown = async (mark: Locator) =>
  mark.evaluate(i => (globalThis as unknown as Win).getComputedStyle(i as unknown as El).opacity !== '0')

// The ellipsis menu button of the list row that names `text` (the innermost element holding both).
export const rowMenuButton = (list: Locator, text: string) =>
  list
    .locator('div')
    .filter({has: list.page().getByText(text, {exact: true})})
    .filter({has: list.page().locator('.icon-gen-iconfont-ellipsis')})
    .last()
    .locator('.icon-gen-iconfont-ellipsis')
    .last()
