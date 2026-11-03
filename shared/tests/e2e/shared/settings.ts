// The smoke account's server-backed settings, read and put back through the host's main service:
// emails, who may message it, link previews, chat notification settings, email subscriptions,
// lockdown and animated emoji. Each restore reads first and sends nothing when the setting already is
// the original, so it can run after any failure; each write is read back. The only email address
// written is this run's stamped example.com one (example.com is reserved: no mail reaches anyone). No
// refusal names an address. Framework-free: shared by the desktop and iOS flows. What lives only on
// the phone (remember-password, proxy, theme, ...) is not here: ios-appium/gate/app-ask.ts asks the
// phone's own service for it.
import {waitFor} from './deadline.ts'
import {e2eRunId} from './run-marker.ts'
import {mainRead} from './teams.ts'
import {mainRpc} from './main-rpc.ts'

const READ_BACK = {timeout: 20_000}

// -- emails ----------------------------------------------------------------------------------------

export type Email = {email: string; isPrimary: boolean; isVerified: boolean; lastVerifyEmailDate: number}

// The smoke account's addresses. Parse-anchored: the list holds a primary address, else this throws,
// so a list that failed or changed shape never reads as an address being gone.
export const emails = async (): Promise<Array<Email>> => {
  const list = (await mainRead<Array<Email> | null>('keybase.1.emails.getEmails', {sessionID: 0})) ?? []
  if (!list.some(e => e.isPrimary)) throw new Error("the smoke account's email list holds no primary address")
  return list
}

export const primaryEmail = async () => (await emails()).find(e => e.isPrimary)?.email ?? ''

// This run's address for one test: `e2e-<runid>-<label>@example.com`.
export const stampedEmail = (label = 'mail') => `e2e-${e2eRunId()}-${label}@example.com`

export const requireStampedEmail = (addr: string) => {
  if (!new RegExp(`^e2e-${e2eRunId()}-[a-z0-9]+@example\\.com$`).test(addr)) {
    throw new Error("refusing an email address that is not this run's stamped example.com address")
  }
  return addr
}

// Deletes this run's address `addr` when the account still lists it, and reads it gone. A primary
// address cannot be deleted: put the original primary back (setPrimaryEmail) first.
export const deleteEmailIfPresent = async (addr: string) => {
  requireStampedEmail(addr)
  const listed = (await emails()).find(e => e.email === addr)
  if (!listed) return
  if (listed.isPrimary) throw new Error("the run's address is the primary one; put the original primary back before deleting it")
  await mainRpc('keybase.1.emails.deleteEmail', {email: addr, sessionID: 0})
  await waitFor('the run address gone from the account', async () => ((await emails()).some(e => e.email === addr) ? undefined : true), READ_BACK)
}

// Makes `addr`, an address the account already lists (the original primary, for a restore), the
// primary one and reads it back; a no-op when it already is.
export const setPrimaryEmail = async (addr: string) => {
  const listed = (await emails()).find(e => e.email === addr)
  if (!listed) throw new Error('refusing to make an address primary that the account does not list')
  if (listed.isPrimary) return
  await mainRpc('keybase.1.emails.setPrimaryEmail', {email: addr, sessionID: 0})
  await waitFor('the primary address put back', async () => ((await primaryEmail()) === addr ? true : undefined), READ_BACK)
}

// -- chat ------------------------------------------------------------------------------------------

export type ContactSettings = {allowFolloweeDegrees: number; allowGoodTeams: boolean; enabled: boolean; teams?: unknown}

// who may message the account, without the server's version, which a save does not take
export const contactSettings = async (): Promise<ContactSettings> => {
  const {allowFolloweeDegrees, allowGoodTeams, enabled, teams} = await mainRead<ContactSettings>('keybase.1.account.userGetContactSettings', {})
  return {allowFolloweeDegrees, allowGoodTeams, enabled, teams}
}

// Whether two JSON-shaped values are the same (keys in the same order).
export const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export const restoreContactSettings = async (original: ContactSettings) => {
  if (same(await contactSettings(), original)) return
  await mainRpc('keybase.1.account.userSetContactSettings', {settings: original})
  await waitFor('the contact settings put back', async () => (same(await contactSettings(), original) ? true : undefined), READ_BACK)
}

export type UnfurlSettings = {blocklist?: ReadonlyArray<string> | null; mode: number; whitelist?: ReadonlyArray<string> | null}

export const unfurlSettings = async () => mainRead<UnfurlSettings>('chat.1.local.getUnfurlSettings', {})

// the lists compare as sets: the service keeps them in no order
export const sortedUnfurl = (s: UnfurlSettings) => ({
  blocklist: [...(s.blocklist ?? [])].sort(),
  mode: s.mode,
  whitelist: [...(s.whitelist ?? [])].sort(),
})

export const restoreUnfurlSettings = async (original: UnfurlSettings) => {
  const want = sortedUnfurl(original)
  if (same(sortedUnfurl(await unfurlSettings()), want)) return
  await mainRpc('chat.1.local.saveUnfurlSettings', want)
  await waitFor('the link preview settings put back', async () => (same(sortedUnfurl(await unfurlSettings()), want) ? true : undefined), READ_BACK)
}

// The account's chat notification settings, the whole map (GlobalAppNotificationSetting by number).
export const globalNotifSettings = async () =>
  (await mainRead<{settings?: Record<string, boolean> | null}>('chat.1.local.getGlobalAppNotificationSettingsLocal', {})).settings ?? {}

const sortedMap = (m: Record<string, boolean>) => Object.fromEntries(Object.entries(m).sort(([a], [b]) => a.localeCompare(b)))

export const restoreGlobalNotifSettings = async (original: Record<string, boolean>) => {
  const want = sortedMap(original)
  if (same(sortedMap(await globalNotifSettings()), want)) return
  await mainRpc('chat.1.local.setGlobalAppNotificationSettingsLocal', {settings: original})
  await waitFor('the chat notification settings put back', async () => (same(sortedMap(await globalNotifSettings()), want) ? true : undefined), READ_BACK)
}

// -- notifications ---------------------------------------------------------------------------------

export type EmailSubscription = {description: string; name: string; subscribed: boolean}
type Subscriptions = {notifications?: Record<string, {settings?: Array<EmailSubscription> | null; unsub?: boolean} | undefined>}

// the notification groups a flow changes: the email settings, and the phone's push settings
export type SubscriptionGroup = 'email' | 'app_push'

const subscriptionGroup = async (group: SubscriptionGroup) => {
  const res = await mainRead<{body: string}>('keybase.1.apiserver.GetWithSession', {args: [], endpoint: 'account/subscriptions'})
  const g = (JSON.parse(res.body) as Subscriptions).notifications?.[group]
  if (!g?.settings?.length) throw new Error(`the account has no ${group} notification settings`)
  return {settings: g.settings, unsub: !!g.unsub}
}

// The account's notification settings in `group`. Refuses an account unsubscribed from all of them:
// its settings cannot be toggled, and turning "Unsubscribe from all" off is never done here.
export const subscriptions = async (group: SubscriptionGroup) => {
  const {settings, unsub} = await subscriptionGroup(group)
  if (unsub) throw new Error(`refusing to change ${group} notification settings of an account unsubscribed from all of them`)
  return settings
}

export const emailSubscriptions = async () => subscriptions('email')

// Puts each notification setting of `group` in `original` back, in one account/subscribe post of the
// ones that differ, and reads them back.
export const restoreSubscriptions = async (group: SubscriptionGroup, original: ReadonlyArray<Pick<EmailSubscription, 'name' | 'subscribed'>>) => {
  for (const {name} of original) if (!/^[a-z0-9_]+$/.test(name)) throw new Error('refusing a notification setting name that is not plain')
  const differing = async () => {
    const now = new Map((await subscriptionGroup(group)).settings.map(s => [s.name, s.subscribed]))
    return original.filter(o => now.get(o.name) !== o.subscribed)
  }
  const changed = await differing()
  if (!changed.length) return
  await mainRpc('keybase.1.apiserver.PostJSON', {
    JSONPayload: changed.map(o => ({key: `${o.name}|${group}`, value: o.subscribed ? '1' : '0'})),
    args: [],
    endpoint: 'account/subscribe',
  })
  await waitFor(`the ${group} notification settings put back`, async () => ((await differing()).length ? undefined : true), READ_BACK)
}

export const restoreEmailSubscriptions = async (original: ReadonlyArray<Pick<EmailSubscription, 'name' | 'subscribed'>>) =>
  restoreSubscriptions('email', original)

// -- display and advanced --------------------------------------------------------------------------

export const lockdown = async () => (await mainRead<{status: boolean}>('keybase.1.account.getLockdownMode', {sessionID: 0})).status

// Turns lockdown mode off and reads it back; a no-op when it is off. Nothing here turns it on.
export const setLockdownMode = async (enabled: false) => {
  if (!(await lockdown())) return
  await mainRpc('keybase.1.account.setLockdownMode', {enabled, sessionID: 0})
  await waitFor('lockdown mode off', async () => ((await lockdown()) ? undefined : true), READ_BACK)
}

// Whether animated emoji are allowed: turning them off keeps a gregor item of this category.
export const emojiAnimations = async () =>
  !(await mainRead<{items?: Array<{item?: {category?: string} | null}> | null}>('keybase.1.gregor.getState', {})).items?.some(
    i => i.item?.category === 'emojianimations'
  )

export const restoreEmojiAnimations = async (was: boolean) => {
  if ((await emojiAnimations()) === was) return
  await mainRpc('chat.1.local.toggleEmojiAnimations', {enabled: was})
  await waitFor('allow animated emoji put back', async () => ((await emojiAnimations()) === was ? true : undefined), READ_BACK)
}
