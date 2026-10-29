// Subteams of the e2e team that one run's team flows make, change and delete, and the read-backs
// those flows check against. Every write here refuses a team that is not a subteam of KB_E2E_TEAM
// named with this run's id (accounts/run-id.ts), so nothing outside that scope is ever changed.
import {randomBytes} from 'crypto'
import {expect, type Locator, type Page} from '@playwright/test'
import escapeRegExp from 'lodash/escapeRegExp'
import {loadE2EAccounts} from '@/tests/e2e/accounts/env'
import {parseStampedName, stampedTeamName} from '@/tests/e2e/accounts/run-id'
import {createThrowawaySubteam, deleteThrowawaySubteam, retryTransient} from '@/tests/e2e/shared/chat-data'
import {convIDBytes} from '@/tests/e2e/shared/conv-id'
import {mainRpc} from '@/tests/e2e/shared/main-rpc'
import {runKeybase} from '@/tests/e2e/shared/peer-service'
import * as T from '@/tests/e2e/shared/test-ids'
import {e2eRunId} from './fixtures'
import {openMenu} from './menu'
import {openE2ESubteam} from './navigate'

// A deleted team's name is never free again, so each attempt in a run takes its own: `prefix`
// (up to 3 characters) and 4 random hex characters, the 7 a stamped team name allows.
const freshLabel = (prefix: string) => `${prefix}${randomBytes(2).toString('hex')}`
export const freshSubteamPart = (prefix: string) => stampedTeamName(freshLabel(prefix), e2eRunId())

// The name part under KB_E2E_TEAM of a subteam this run made; throws for any other team.
export const requireThisRunSubteam = (name: string) => {
  const {team} = loadE2EAccounts()
  const part = name.startsWith(`${team}.`) ? name.slice(team.length + 1) : ''
  if (!part || part.includes('.') || parseStampedName(part, 'team')?.runId !== e2eRunId()) {
    throw new Error(`refusing to act on ${part || 'a team'}: not a subteam of the e2e team made by this run`)
  }
  return part
}

// A read-back through the main service or the CLI, again when the server refused it in passing.
export const readBack = async <R,>(f: () => Promise<R>): Promise<R> => (await retryTransient(f)) as R

// One main-service read-back (mainRpc), through readBack.
export const mainRead = async <R,>(method: string, arg: object) => readBack(async () => mainRpc<R>(method, arg))

// What the service answers for `name` when it names no team the account can load: a deleted team's
// name answers like one never made ("not a member", code 2623; the server's team-not-found, code
// 2614, which the service rewrites as `Team "<name>" does not exist`) or as tombstoned, and a
// renamed team's old name as a bad name (the team it resolved to is now called something else).
// Each is anchored to its own wording, so another error that happens to say "not found" is not
// read as the team being gone.
const goneRe = (name: string) =>
  new RegExp(
    `\\(code 26(?:14|23)\\)|\\btombstoned\\b|\\bTeam "${escapeRegExp(name)}"(?: \\(public\\))? does not exist\\b|\\bbad name error\\b`,
    'i'
  )

// Whether a subteam exists, by its exact name: the service resolves the name to an id, or says it
// names no team. (A listing of the parent's subteams fails outright for a while after any subteam
// of it is deleted.)
export const subteamExists = async (name: string) => {
  try {
    await mainRead<string>('keybase.1.teams.getTeamID', {teamName: name})
    return true
  } catch (e) {
    if (goneRe(name).test(e instanceof Error ? e.message : String(e))) return false
    throw e
  }
}

// Deletes one of this run's subteams through the CLI when it is still there, then waits until the
// service no longer lists it.
export const deleteSubteamIfPresent = async (name: string) => {
  requireThisRunSubteam(name)
  if (await subteamExists(name)) await deleteThrowawaySubteam(name)
  await expect.poll(async () => subteamExists(name), {message: 'the subteam after its delete', timeout: 30_000}).toBe(false)
}

// A subteam of the e2e team for one test, made through the CLI with the smoke account as admin.
// `prefix` is up to 3 characters.
export const makeSubteam = async (prefix: string) => createThrowawaySubteam(freshLabel(prefix))

export type TeamRoleName = 'owner' | 'admin' | 'writer' | 'reader' | 'bot' | 'restrictedbot'
type ListMembers = {
  members: Partial<Record<'owners' | 'admins' | 'writers' | 'readers' | 'bots' | 'restrictedBots', Array<{username: string}> | null>>
  annotatedActiveInvites?: Record<string, {invite: {id: string; name: string; type: {c: number; unknown?: string; sbs?: string}}; displayName?: string}> | null
}
const listMembers = async (name: string) =>
  JSON.parse(await readBack(async () => runKeybase(['team', 'list-members', name, '-j'], {timeoutMs: 60_000}))) as ListMembers

// Each member's role in a team, read through the CLI.
export const memberRoles = async (name: string): Promise<Record<string, TeamRoleName>> => {
  const {members} = await listMembers(name)
  const roles: Record<string, TeamRoleName> = {}
  const of = {admins: 'admin', bots: 'bot', owners: 'owner', readers: 'reader', restrictedBots: 'restrictedbot', writers: 'writer'} as const
  for (const [key, role] of Object.entries(of)) {
    for (const m of members[key as keyof typeof of] ?? []) roles[m.username] = role
  }
  return roles
}

// The names a team's pending invites are for (an email address, a phone number, a username).
export const inviteNames = async (name: string) =>
  Object.values((await listMembers(name)).annotatedActiveInvites ?? {}).map(i => i.displayName || i.invite.name)

export const teamID = async (name: string) => readBack(async () => mainRpc<string>('keybase.1.teams.getTeamID', {teamName: name}))

// One of a team's conversations as the main service localizes it.
export type ConvInfo = {headline: string; topicName: string}
export const conversationInfo = async (convID: string): Promise<ConvInfo> => {
  const res = await readBack(async () =>
    mainRpc<{conversations?: Array<{info: ConvInfo}> | null}>('chat.1.local.getInboxAndUnboxLocal', {
      identifyBehavior: 6, // chatSkip
      query: {computeActiveList: false, convIDs: [convIDBytes(convID)], readOnly: true, unreadOnly: false},
    })
  )
  const conv = res.conversations?.[0]
  if (!conv) throw new Error('the main service reads no such conversation')
  return conv.info
}

// A team's channels by topic name, read through the CLI.
export const teamChannels = async (name: string) => {
  const res = await runChatApi<{conversations?: Array<{channel: {topic_name?: string}; id: string}> | null}>('listconvsonname', {
    members_type: 'team',
    name,
    topic_type: 'CHAT',
  })
  return new Map((res.conversations ?? []).map(c => [c.channel.topic_name ?? '', c.id]))
}

// Makes a channel in one of this run's subteams through the CLI, and returns its conversation id.
export const makeSubteamChannel = async (subteam: string, topicName: string) => {
  requireThisRunSubteam(subteam)
  if (parseStampedName(topicName, 'dashed')?.runId !== e2eRunId()) throw new Error(`#${topicName} is not a channel name of this run`)
  await retryTransient(async () => runKeybase(['chat', 'create-channel', subteam, topicName], {timeoutMs: 60_000}), /already exists/i)
  const id = (await teamChannels(subteam)).get(topicName)
  if (!id) throw new Error(`#${topicName} was not created`)
  return id
}

// A team channel's members, by username, read through the CLI.
export const channelMembers = async (team: string, topicName: string) => {
  type M = Partial<Record<'owners' | 'admins' | 'writers' | 'readers', Array<{username: string}> | null>>
  const r = await runChatApi<M>('listmembers', {channel: {members_type: 'team', name: team, topic_name: topicName}})
  return [...(r.owners ?? []), ...(r.admins ?? []), ...(r.writers ?? []), ...(r.readers ?? [])].map(m => m.username)
}

// Adds a user to one of this run's subteams through the CLI, as setup.
export const addToSubteamFromCli = async (subteam: string, username: string, role: 'reader' | 'writer') => {
  requireThisRunSubteam(subteam)
  await retryTransient(
    async () => runKeybase(['team', 'add-member', subteam, `--user=${username}`, `--role=${role}`, '--skip-chat-message'], {timeoutMs: 60_000}),
    /already a member/i
  )
}

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

// One `keybase chat api` call through the CLI, as setup or a read-back.
export const runChatApi = async <R,>(method: string, options: object): Promise<R> => {
  const out = await readBack(async () => runKeybase(['chat', 'api', '-m', JSON.stringify({method, params: {options}})], {timeoutMs: 60_000}))
  const res = JSON.parse(out) as {error?: {message: string}; result?: R}
  if (res.error) throw new Error(`chat api ${method}: ${res.error.message}`)
  return res.result as R
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
