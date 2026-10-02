// "Incoming message from another account" for flows on a device signed in as KB_SMOKE_USER: a
// React Native debug build signed in as KB_SECOND_USER (a booted simulator attached to Metro) sends
// the message from its own JS runtime, the path lifecycle.ts uses for its second device.
//
// The sender is looked up, never assumed: when Metro is down, or no attached app is signed in as
// the second account, it comes back with the reason instead, so a flow can skip saying why.
//
// The same attached app also acts as the team owner (KB_SMOKE_USER) for desktop flows that run the
// app as the second account: the desktop CLI talks to the desktop app's service, so it is whoever
// the app is signed in as and cannot act as the owner meanwhile.
import {evalInPage, listInspectorPages, metroOrigin, type InspectorPage} from './metro-eval'

// The app ids a Keybase debug build registers with Metro (iOS bundle id, Android package).
const appIds = new Set(['keybase.ios', 'io.keybase.ossifrage'])

export type IncomingSender =
  | {
      ok: true
      // the Metro device name the sender runs on
      device: string
      // tlfName is the team name for a team channel
      send: (conversationIDKey: string, tlfName: string, text: string) => Promise<void>
      // tells the conversation's other members the second account is typing (or stopped)
      typing: (conversationIDKey: string, on: boolean) => Promise<void>
    }
  | {ok: false; reason: string}

type Account = {loggedIn: boolean; username: string}

const signedInAs = async (page: InspectorPage) =>
  evalInPage<Account>(
    page,
    `return {
       loggedIn: kbModule('stores/config.tsx').useConfigState.getState().loggedIn,
       username: kbModule('stores/current-user.tsx').useCurrentUserState.getState().username,
     }`
  )

const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// The newest page of each Keybase debug build attached to Metro, by device: an app restart leaves
// the old runtime's page listed ahead of it.
const attachedApps = async (): Promise<Map<string, InspectorPage>> => {
  const newest = new Map<string, InspectorPage>()
  for (const p of await listInspectorPages()) {
    if (p.appId && appIds.has(p.appId) && p.deviceName) newest.set(p.deviceName, p)
  }
  return newest
}

type Found = {ok: true; device: string; page: InspectorPage} | {ok: false; reason: string}

// The attached app signed in as `username`, or why there is none.
const findAppSignedInAs = async (username: string): Promise<Found> => {
  let apps: Map<string, InspectorPage>
  try {
    apps = await attachedApps()
  } catch (e) {
    return {ok: false, reason: `Metro is not reachable at ${metroOrigin} (${String(e)})`}
  }
  if (!apps.size) {
    return {ok: false, reason: 'no Keybase debug build is attached to Metro'}
  }
  const seen: Array<string> = []
  for (const [device, page] of apps) {
    const account = await signedInAs(page).catch(() => undefined)
    seen.push(`${device}: ${account ? (account.loggedIn ? 'signed in' : 'signed out') : 'no answer'}`)
    if (account?.loggedIn && account.username === username) {
      return {device, ok: true, page}
    }
  }
  return {ok: false, reason: `no app attached to Metro is signed in as that account (${seen.join('; ')})`}
}

export const findIncomingSender = async (username: string): Promise<IncomingSender> => {
  const found = await findAppSignedInAs(username)
  if (!found.ok) return found
  const {device, page} = found
  const send = async (conversationIDKey: string, tlfName: string, text: string) => {
    await evalInPage(
      page,
      `kbModule('chat/conversation/send-actions.tsx').sendTextToConversation(${JSON.stringify(conversationIDKey)}, ${JSON.stringify(tlfName)}, ${JSON.stringify(text)}); return true`
    )
  }
  const typing = async (conversationIDKey: string, on: boolean) => {
    await evalInPage(
      page,
      `const conversationID = kbModule('constants/types/chat/index.tsx').keyToConversationID(${JSON.stringify(conversationIDKey)});
       kbModule('constants/rpc/rpc-chat-gen.tsx').localUpdateTypingRpcPromise({conversationID, typing: ${on}}); return true`
    )
  }
  return {device, ok: true, send, typing}
}

// Switches the one attached app to `username`, an account already signed in on that device, through
// the app's own account switch, and waits until it is signed in as it.
export const switchAttachedApp = async (username: string, timeoutMs = 60_000) => {
  if ((await findAppSignedInAs(username)).ok) return
  const apps = await attachedApps()
  const [device, page] = [...apps][0] ?? []
  if (apps.size !== 1 || !device || !page) {
    throw new Error(`switching the attached app needs exactly one attached, found ${apps.size}`)
  }
  const started = await evalInPage<boolean>(
    page,
    `return !!kbModule('stores/config.tsx').useConfigState.getState().dispatch.switchToAccount(${JSON.stringify(username)})`
  )
  if (!started) throw new Error(`${device} would not switch accounts (is the account signed in there?)`)
  const deadline = Date.now() + timeoutMs
  let last: Found | undefined
  while (Date.now() < deadline) {
    await sleep(1_000)
    last = await findAppSignedInAs(username)
    if (last.ok) return
  }
  throw new Error(`${device} was not signed in as the account ${timeoutMs / 1000}s after switching (${last && !last.ok ? last.reason : ''})`)
}

// Channel changes made as the team owner, from an attached app signed in as the owner.
export type ChannelOwner =
  | {
      ok: true
      device: string
      removeFromChannel: (conversationIDKey: string, username: string) => Promise<void>
      // the lowest team role that can post in the channel: 'none' lets every member post
      setMinWriterRole: (conversationIDKey: string, role: keyof typeof teamRoles) => Promise<void>
    }
  | {ok: false; reason: string}

// TeamRole in the protocol
const teamRoles = {admin: 3, none: 0, writer: 2} as const

export const findChannelOwner = async (owner: string): Promise<ChannelOwner> => {
  const found = await findAppSignedInAs(owner)
  if (!found.ok) return found
  const {device, page} = found
  // Starts the RPC `call` builds (from `convID`), then polls for its outcome: an evaluate returns
  // synchronously.
  const runRpc = async (what: string, conversationIDKey: string, call: string) => {
    const key = `__e2eOwnerRpc${Date.now()}`
    await evalInPage(
      page,
      `const g = globalThis; g.${key} = 'pending';
       const convID = kbModule('constants/types/chat/index.tsx').keyToConversationID(${JSON.stringify(conversationIDKey)});
       const rpc = kbModule('constants/rpc/rpc-chat-gen.tsx');
       (${call}).then(() => { g.${key} = 'done' }, e => { g.${key} = 'error: ' + (e && e.message) });
       return true`
    )
    const deadline = Date.now() + 20_000
    for (;;) {
      const state = await evalInPage<string>(page, `return globalThis.${key}`)
      if (state === 'done') return
      if (state !== 'pending') throw new Error(`${what} failed on ${device}: ${state}`)
      if (Date.now() > deadline) throw new Error(`${what} on ${device}: no answer in 20s`)
      await sleep(250)
    }
  }
  const removeFromChannel = async (conversationIDKey: string, username: string) =>
    runRpc(
      'removing from the channel',
      conversationIDKey,
      `rpc.localRemoveFromConversationLocalRpcPromise({convID, usernames: [${JSON.stringify(username)}]})`
    )
  const setMinWriterRole = async (conversationIDKey: string, role: keyof typeof teamRoles) =>
    runRpc(
      `setting the channel's minimum writer role to ${role}`,
      conversationIDKey,
      `rpc.localSetConvMinWriterRoleLocalRpcPromise({convID, role: ${teamRoles[role]}})`
    )
  return {device, ok: true, removeFromChannel, setMinWriterRole}
}
