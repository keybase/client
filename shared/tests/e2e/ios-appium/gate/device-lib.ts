// Pure part of device.ts, kept apart so jest can test it without the simulator: the simctl privacy
// argv and its restore, the push payload, and which photo corpus items a simulator still needs.
import {clearGatePoison, poisonGate} from './poison-lib.ts'

const BUNDLE_ID = 'keybase.ios'

// The simctl privacy services a flow may grant. Contacts are never granted (importing them uploads
// the whole address book).
export const PRIVACY_SERVICES = ['location', 'location-always', 'photos', 'photos-add'] as const
export type PrivacyService = (typeof PRIVACY_SERVICES)[number]

// Each service's row in the simulator's TCC.db. Location is not kept there (locationd keeps it).
const TCC_SERVICE: Record<PrivacyService, string | undefined> = {
  location: undefined,
  'location-always': undefined,
  photos: 'kTCCServicePhotos',
  'photos-add': 'kTCCServicePhotosAdd',
}

export type TccRow = {service: string; authValue: number}

// `sqlite3 -readonly -json TCC.db "SELECT service, auth_value FROM access WHERE client='keybase.ios'"`:
// no rows prints nothing.
export const parseTcc = (out: string): Array<TccRow> => {
  if (!out.trim()) return []
  let rows: unknown
  try {
    rows = JSON.parse(out)
  } catch {
    throw new Error('the TCC read printed something that is not json rows')
  }
  if (!Array.isArray(rows)) throw new Error('the TCC read printed json that is not a list of rows')
  return rows.map((r: unknown) => {
    const {auth_value, service} = (r ?? {}) as {auth_value?: unknown; service?: unknown}
    if (typeof service !== 'string' || typeof auth_value !== 'number') throw new Error('the TCC read printed a row without a service and an auth value')
    return {authValue: auth_value, service}
  })
}

// granted, denied: TCC auth_value 2, 0. unset: no row (never asked). limited: 3, which simctl cannot
// grant back. not-in-tcc: location, whose original this cannot read; its restore is a reset, the
// state the run starts from.
export type PrivacyState = 'granted' | 'denied' | 'unset' | 'limited' | 'not-in-tcc'
export type PrivacyOriginal = {bundleId: string; service: PrivacyService; state: PrivacyState}

const stateOf = (authValue: number): PrivacyState | undefined =>
  authValue === 2 ? 'granted' : authValue === 0 ? 'denied' : authValue === 3 ? 'limited' : undefined

export const privacyOriginal = (rows: ReadonlyArray<TccRow>, service: PrivacyService): PrivacyOriginal => {
  const tcc = TCC_SERVICE[service]
  if (!tcc) return {bundleId: BUNDLE_ID, service, state: 'not-in-tcc'}
  const mine = rows.filter(r => r.service === tcc)
  if (mine.length > 1) throw new Error(`the TCC read has more than one ${service} row for ${BUNDLE_ID}`)
  const [row] = mine
  if (!row) return {bundleId: BUNDLE_ID, service, state: 'unset'}
  const state = stateOf(row.authValue)
  if (!state) throw new Error(`the TCC read has ${service} at auth value ${row.authValue}, which this cannot put back`)
  return {bundleId: BUNDLE_ID, service, state}
}

const udidRe = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i

// The udid the release preflight proved booted (release.mts passes it as KB_IOS_UDID), never one a
// name lookup found: two simulators may share a name.
export const requireUdid = (udid: string | undefined) => {
  if (!udid || !udidRe.test(udid)) {
    throw new Error("KB_IOS_UDID is not a simulator udid: set it to the booted iPhoneTest's udid (the release command sets it)")
  }
  return udid
}

// A reset or grant without the bundle id, or for `all`, changes every app on the simulator.
const checkTarget = (service: string, udid: string, bundleId: string) => {
  if (bundleId !== BUNDLE_ID) throw new Error(`refusing a simctl privacy call whose bundle id is not ${BUNDLE_ID}`)
  if (!(PRIVACY_SERVICES as ReadonlyArray<string>).includes(service)) throw new Error('refusing a simctl privacy service that is not one a flow may grant')
  if (!udidRe.test(udid)) throw new Error('refusing a simctl privacy call without a simulator udid')
}

export const privacyGrantArgs = (service: PrivacyService, udid: string, bundleId: string) => {
  checkTarget(service, udid, bundleId)
  return ['privacy', udid, 'grant', service, bundleId]
}

// The simctl argv that puts `service` back to `original`.
export const privacyRestoreArgs = (original: PrivacyOriginal, service: PrivacyService, udid: string) => {
  checkTarget(service, udid, original.bundleId)
  if (original.service !== service) throw new Error('refusing to restore one permission from the original of another')
  const action = {denied: 'revoke', granted: 'grant', limited: undefined, 'not-in-tcc': 'reset', unset: 'reset'}[original.state]
  if (!action) throw new Error(`refusing to grant ${service}: its original is ${original.state}, which simctl cannot put back`)
  return ['privacy', udid, action, service, original.bundleId]
}

// What grantPrivacy hands the flow's afterEach to put the permission back with; done once it has.
export type PrivacyRestore = {done: boolean; original: PrivacyOriginal; udid: string}

const restoreName = (service: PrivacyService) => `the ${service} permission for ${BUNDLE_ID}`

// Puts the permission back once: a second call does nothing, and one whose permission already reads
// as its original runs nothing. A restore that fails or does not take poisons the gate, naming the
// simctl call to run by hand, and throws. simctl only, so a hook can run it: a reset may terminate
// the app, and the next test's beforeEach brings it back.
export const restorePrivacyWith = (
  r: PrivacyRestore,
  io: {read: () => ReadonlyArray<TccRow>; run: (args: ReadonlyArray<string>) => void}
) => {
  if (r.done) return
  const {service} = r.original
  const what = restoreName(service)
  let args: ReadonlyArray<string> | undefined
  try {
    args = privacyRestoreArgs(r.original, service, r.udid)
    const readable = r.original.state !== 'not-in-tcc'
    if (!readable || privacyOriginal(io.read(), service).state !== r.original.state) {
      io.run(args)
      if (readable) {
        const now = privacyOriginal(io.read(), service).state
        if (now !== r.original.state) throw new Error(`it still reads ${now}, not ${r.original.state}`)
      }
    }
  } catch (e) {
    poisonGate(what, args ? `run xcrun simctl ${args.join(' ')}` : `put it back in the simulator's Settings > Privacy & Security`)
    throw new Error(`restoring ${what} failed: ${e instanceof Error ? e.message : String(e)}`, {cause: e})
  }
  r.done = true
  clearGatePoison(what)
}

// -- push --------------------------------------------------------------------------------------------

export type PushPayload = {
  aps: {alert: {body: string; title: string}; sound: string}
  convID: string
  m: string
  t: string
  type: string
  uid: string
}

const convIDRe = /^[0-9a-f]{16,128}$/
const uidRe = /^[0-9a-f]{32}$/
// e2eMarker('push-<label>'): the run's stamp, so the body names no account, team or conversation
const pushBodyRe = /^e2e-[0-9a-z]{5}[0-9]-push-[a-z0-9-]{1,40}$/

// The one push type a flow sends: chat.newmessage shows a banner, and its tap carries the
// conversation. Never chat.newmessageSilent_2, which hands the payload's body to the service.
export const requireTappablePush = (p: PushPayload): PushPayload => {
  if (p.type !== 'chat.newmessage') throw new Error('refusing a push whose type is not chat.newmessage')
  const keys = Object.keys(p).sort().join(',')
  if (keys !== 'aps,convID,m,t,type,uid') throw new Error('refusing a push with fields beyond a chat.newmessage')
  const aps = p.aps as Record<string, unknown>
  if (Object.keys(aps).sort().join(',') !== 'alert,sound') throw new Error('refusing a push whose aps is not an alert and a sound (no content-available)')
  if (!pushBodyRe.test(p.aps.alert.body) || p.aps.alert.title !== 'e2e') throw new Error('refusing a push body that is not a stamped push marker')
  if (!convIDRe.test(p.convID) || !uidRe.test(p.uid) || p.m !== '' || p.t !== '1') throw new Error('refusing a push whose ids are not ids')
  return p
}

// A banner for `convID`, for the account `uid`, showing the stamped `body`.
export const chatNewMessagePayload = (o: {convID: string; uid: string; body: string}): PushPayload =>
  requireTappablePush({
    aps: {alert: {body: o.body, title: 'e2e'}, sound: 'default'},
    convID: o.convID,
    m: '',
    t: '1',
    type: 'chat.newmessage',
    uid: o.uid,
  })

// -- the photo corpus --------------------------------------------------------------------------------

export type CorpusRecordItem = {name: string; sha256: string}

// The wanted items the simulator has never had added, by content: a recorded item is never added
// again, whatever its name; a corpus file whose bytes changed is a new item.
export const corpusDiff = <T extends CorpusRecordItem>(recorded: ReadonlyArray<CorpusRecordItem>, wanted: ReadonlyArray<T>): Array<T> => {
  const have = new Set(recorded.map(r => r.sha256))
  return wanted.filter(w => !have.has(w.sha256))
}
