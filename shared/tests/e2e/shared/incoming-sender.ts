// "Incoming message from another account" for flows on a device signed in as KB_SMOKE_USER: a
// React Native debug build signed in as KB_SECOND_USER (a booted simulator attached to Metro) sends
// the message from its own JS runtime, the path lifecycle.ts uses for its second device.
//
// The sender is looked up, never assumed: when Metro is down, or no attached app is signed in as
// the second account, it comes back with the reason instead, so a flow can skip saying why.
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

export const findIncomingSender = async (username: string): Promise<IncomingSender> => {
  let pages: Array<InspectorPage>
  try {
    pages = await listInspectorPages()
  } catch (e) {
    return {ok: false, reason: `Metro is not reachable at ${metroOrigin} (${String(e)})`}
  }
  // newest page per device: an app restart leaves the old runtime's page listed ahead of it
  const newest = new Map<string, InspectorPage>()
  for (const p of pages) {
    if (p.appId && appIds.has(p.appId) && p.deviceName) newest.set(p.deviceName, p)
  }
  if (!newest.size) {
    return {ok: false, reason: 'no Keybase debug build is attached to Metro'}
  }
  const seen: Array<string> = []
  for (const [device, page] of newest) {
    const account = await signedInAs(page).catch(() => undefined)
    seen.push(`${device}: ${account ? (account.loggedIn ? 'signed in' : 'signed out') : 'no answer'}`)
    if (account?.loggedIn && account.username === username) {
      const send = async (conversationIDKey: string, tlfName: string, text: string) => {
        await evalInPage(
          page,
          `kbModule('chat/conversation/send-actions.tsx').sendTextToConversation(${JSON.stringify(conversationIDKey)}, ${JSON.stringify(tlfName)}, ${JSON.stringify(text)}); return true`
        )
      }
      return {device, ok: true, send}
    }
  }
  return {ok: false, reason: `no app attached to Metro is signed in as the second account (${seen.join('; ')})`}
}
