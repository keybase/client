// Pure part of device.ts, kept apart so jest can test it without the simulator: the simctl privacy
// argv and its restore, the push payload, and which photo corpus items a simulator still needs.
import {clearGatePoison, poisonGate} from './poison-lib.ts'

const BUNDLE_ID = 'keybase.ios'

// The simctl privacy services a flow may grant. Contacts are never granted (importing them uploads
// the whole address book).
export const PRIVACY_SERVICES = ['location', 'location-always', 'photos', 'photos-add'] as const
export type PrivacyService = (typeof PRIVACY_SERVICES)[number]

// Each photo service's row in the simulator's TCC.db. Location is not kept there: locationd keeps it
// in its clients.plist (parseLocationd).
const TCC_SERVICE: Record<'photos' | 'photos-add', string> = {
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

// keybase.ios's location authorization in locationd's clients.plist (`plutil -convert xml1 -o -`): the
// `Authorization` integer of its `ikeybase.ios:` entry, undefined when it has none (never asked; a
// reset removes it) or no entry at all.
export const parseLocationd = (xml: string): number | undefined => {
  const key = `<key>i${BUNDLE_ID}:</key>`
  const at = xml.indexOf(key)
  if (at < 0) return undefined
  if (xml.includes(key, at + key.length)) throw new Error(`the locationd read has more than one ${BUNDLE_ID} entry`)
  const rest = xml.slice(at + key.length)
  const open = /^\s*<dict>/.exec(rest)
  if (!open) throw new Error(`the locationd read has a ${BUNDLE_ID} entry that is not a dict`)
  // the entry's own dict, up to its matching close
  const tags = /<(\/?)dict>/g
  tags.lastIndex = open[0].length
  let depth = 1
  let end = -1
  for (let m = tags.exec(rest); m; m = tags.exec(rest)) {
    depth += m[1] ? -1 : 1
    if (depth === 0) {
      end = m.index
      break
    }
  }
  if (end < 0) throw new Error(`the locationd read has a ${BUNDLE_ID} entry that does not close`)
  // its own keys only: each dict nested in it is cut out first, innermost out
  const innermost = /<dict>(?:(?!<\/?dict>)[\s\S])*<\/dict>/g
  let own = rest.slice(open[0].length, end)
  while (own.includes('<dict>')) own = own.replace(innermost, '')
  const auth = /<key>Authorization<\/key>\s*<integer>(-?\d+)<\/integer>/.exec(own)
  return auth ? Number(auth[1]) : undefined
}

// What grantPrivacy and restorePrivacy read: the app's TCC rows and its locationd authorization.
export type PrivacySnapshot = {locationAuth: number | undefined; tcc: ReadonlyArray<TccRow>}

// granted, denied: TCC auth_value 2, 0; locationd Authorization 2 (while using) or 4 (always) for the
// service of that name, 1 denied. unset: no row or no Authorization (never asked). limited: TCC 3,
// which simctl cannot grant back; nor can it put back the other location level than the one granted.
export type PrivacyState = 'granted' | 'denied' | 'unset' | 'limited'
export type PrivacyOriginal = {bundleId: string; service: PrivacyService; state: PrivacyState}

const stateOf = (authValue: number): PrivacyState | undefined =>
  authValue === 2 ? 'granted' : authValue === 0 ? 'denied' : authValue === 3 ? 'limited' : undefined

const LOCATION_GRANTED: Record<'location' | 'location-always', number> = {location: 2, 'location-always': 4}

const locationStateOf = (service: 'location' | 'location-always', auth: number | undefined): PrivacyState | undefined =>
  auth === undefined ? 'unset' : auth === 1 ? 'denied' : auth === LOCATION_GRANTED[service] ? 'granted' : undefined

export const privacyOriginal = (snap: PrivacySnapshot, service: PrivacyService): PrivacyOriginal => {
  if (service === 'location' || service === 'location-always') {
    const state = locationStateOf(service, snap.locationAuth)
    if (!state) throw new Error(`the locationd read has location at authorization ${snap.locationAuth}, which this cannot put back as ${service}`)
    return {bundleId: BUNDLE_ID, service, state}
  }
  const tcc = TCC_SERVICE[service]
  const mine = snap.tcc.filter(r => r.service === tcc)
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
  const action = {denied: 'revoke', granted: 'grant', limited: undefined, unset: 'reset'}[original.state]
  if (!action) throw new Error(`refusing to grant ${service}: its original is ${original.state}, which simctl cannot put back`)
  return ['privacy', udid, action, service, original.bundleId]
}

// What grantPrivacy hands the flow's afterEach to put the permission back with; done once it has.
export type PrivacyRestore = {done: boolean; original: PrivacyOriginal; udid: string}

// The permission as it is now; one no original could hold (location at the other level) reads as
// such, so the restore still runs.
const stateNow = (snap: PrivacySnapshot, service: PrivacyService) => {
  try {
    return privacyOriginal(snap, service).state
  } catch {
    return 'something it cannot put back'
  }
}

const restoreName = (service: PrivacyService) => `the ${service} permission for ${BUNDLE_ID}`

// Puts the permission back once: a second call does nothing, and one whose permission already reads
// as its original runs nothing. After the restore runs, `readBack` polls its check (the permission
// read as its original) for a few seconds: locationd writes clients.plist on its own schedule. A
// restore that fails or does not take poisons the gate, naming the simctl call to run by hand, and
// throws. Answers whether it ran the restore. simctl only, so a hook can run it: a reset may terminate
// the app, and the caller waits that out (device.ts restorePrivacy).
export const restorePrivacyWith = async (
  r: PrivacyRestore,
  io: {read: () => PrivacySnapshot; readBack: (taken: () => boolean) => Promise<boolean>; run: (args: ReadonlyArray<string>) => void}
): Promise<boolean> => {
  if (r.done) return false
  const {service} = r.original
  const what = restoreName(service)
  let args: ReadonlyArray<string> | undefined
  let ran = false
  try {
    args = privacyRestoreArgs(r.original, service, r.udid)
    if (stateNow(io.read(), service) !== r.original.state) {
      io.run(args)
      ran = true
      if (!(await io.readBack(() => stateNow(io.read(), service) === r.original.state))) {
        throw new Error(`it still reads ${stateNow(io.read(), service)}, not ${r.original.state}`)
      }
    }
  } catch (e) {
    poisonGate(what, args ? `run xcrun simctl ${args.join(' ')}` : `put it back in the simulator's Settings > Privacy & Security`)
    throw new Error(`restoring ${what} failed: ${e instanceof Error ? e.message : String(e)}`, {cause: e})
  }
  r.done = true
  clearGatePoison(what)
  return ran
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

export type PushTarget = {convID: string; uid: string; body: string}

// A banner for `convID`, for the account `uid`, showing the stamped `body`: the one push a flow sends.
// chat.newmessage shows a banner, and its tap carries the conversation; never
// chat.newmessageSilent_2, which hands the payload's body to the service, and no content-available.
export const chatNewMessagePayload = (o: PushTarget): PushPayload => {
  if (!pushBodyRe.test(o.body)) throw new Error('refusing a push body that is not a stamped push marker')
  if (!convIDRe.test(o.convID) || !uidRe.test(o.uid)) throw new Error('refusing a push whose ids are not ids')
  return {
    aps: {alert: {body: o.body, title: 'e2e'}, sound: 'default'},
    convID: o.convID,
    m: '',
    t: '1',
    type: 'chat.newmessage',
    uid: o.uid,
  }
}

// -- the photo corpus --------------------------------------------------------------------------------

export type CorpusRecordItem = {name: string; sha256: string}

// A simulator's entry in the record: the identity of its data (sim-data.ts simulatorDataBirth)
// when the items were added, and the items.
export type CorpusEntry = {data: number; items: ReadonlyArray<CorpusRecordItem>}

// What to add to a simulator whose data now has identity `data`: everything when its entry was
// recorded for other data (the simulator was erased, and its library with it), else what corpusDiff
// says.
export const corpusToAdd = <T extends CorpusRecordItem>(entry: CorpusEntry | undefined, data: number, wanted: ReadonlyArray<T>): Array<T> =>
  entry?.data === data ? corpusDiff(entry.items, wanted) : [...wanted]

// The wanted items the simulator has never had added, by content: a recorded item is never added
// again, whatever its name; a corpus file whose bytes changed is a new item.
export const corpusDiff = <T extends CorpusRecordItem>(recorded: ReadonlyArray<CorpusRecordItem>, wanted: ReadonlyArray<T>): Array<T> => {
  const have = new Set(recorded.map(r => r.sha256))
  return wanted.filter(w => !have.has(w.sha256))
}
