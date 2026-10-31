import {
  chatNewMessagePayload,
  corpusDiff,
  corpusToAdd,
  parseTcc,
  privacyGrantArgs,
  privacyOriginal,
  privacyRestoreArgs,
  requireTappablePush,
  requireUdid,
  restorePrivacyWith,
  type PrivacyRestore,
} from './device-lib'
import {clearGatePoison, gatePoisoned} from './poison-lib'

const UDID = 'B338EAF5-6A0E-4CAF-BD25-446C674751FB'

afterEach(() => {
  for (const s of ['photos', 'photos-add', 'location', 'location-always']) clearGatePoison(`the ${s} permission for keybase.ios`)
})

describe('the TCC snapshot', () => {
  test("parses sqlite3's json rows, and no rows at all", () => {
    expect(parseTcc('')).toEqual([])
    expect(parseTcc('\n')).toEqual([])
    expect(parseTcc('[{"service":"kTCCServicePhotos","auth_value":2},\n{"service":"kTCCServicePhotosAdd","auth_value":0}]\n')).toEqual([
      {authValue: 2, service: 'kTCCServicePhotos'},
      {authValue: 0, service: 'kTCCServicePhotosAdd'},
    ])
  })

  test('refuses output that is not rows of a service and an auth value', () => {
    expect(() => parseTcc('Error: unable to open database')).toThrow(/^the TCC read /)
    expect(() => parseTcc('[{"service":"kTCCServicePhotos"}]')).toThrow(/^the TCC read /)
    expect(() => parseTcc('{"service":"kTCCServicePhotos","auth_value":2}')).toThrow(/^the TCC read /)
  })

  test("reads the original of each service: allowed, denied, never asked, and location (not kept in TCC)", () => {
    const rows = parseTcc('[{"service":"kTCCServicePhotos","auth_value":2},{"service":"kTCCServicePhotosAdd","auth_value":0}]')
    expect(privacyOriginal(rows, 'photos')).toEqual({bundleId: 'keybase.ios', service: 'photos', state: 'granted'})
    expect(privacyOriginal(rows, 'photos-add')).toEqual({bundleId: 'keybase.ios', service: 'photos-add', state: 'denied'})
    expect(privacyOriginal([], 'photos')).toEqual({bundleId: 'keybase.ios', service: 'photos', state: 'unset'})
    expect(privacyOriginal(rows, 'location-always')).toEqual({bundleId: 'keybase.ios', service: 'location-always', state: 'not-in-tcc'})
    expect(privacyOriginal([{authValue: 3, service: 'kTCCServicePhotos'}], 'photos').state).toBe('limited')
    expect(() => privacyOriginal([{authValue: 2, service: 'kTCCServicePhotos'}, {authValue: 0, service: 'kTCCServicePhotos'}], 'photos')).toThrow(
      /more than one/
    )
  })
})

describe('simctl privacy argv', () => {
  test('a grant names the udid, the service and keybase.ios', () => {
    expect(privacyGrantArgs('location-always', UDID, 'keybase.ios')).toEqual(['privacy', UDID, 'grant', 'location-always', 'keybase.ios'])
  })

  test('a restore puts back exactly what was there: grant, revoke or reset, always for keybase.ios', () => {
    const o = (state: 'granted' | 'denied' | 'unset' | 'not-in-tcc') => ({bundleId: 'keybase.ios', service: 'photos' as const, state})
    expect(privacyRestoreArgs(o('granted'), 'photos', UDID)).toEqual(['privacy', UDID, 'grant', 'photos', 'keybase.ios'])
    expect(privacyRestoreArgs(o('denied'), 'photos', UDID)).toEqual(['privacy', UDID, 'revoke', 'photos', 'keybase.ios'])
    expect(privacyRestoreArgs(o('unset'), 'photos', UDID)).toEqual(['privacy', UDID, 'reset', 'photos', 'keybase.ios'])
    expect(privacyRestoreArgs({bundleId: 'keybase.ios', service: 'location', state: 'not-in-tcc'}, 'location', UDID)).toEqual([
      'privacy',
      UDID,
      'reset',
      'location',
      'keybase.ios',
    ])
  })

  test('refuses a missing or other bundle id, all, an empty or name-like udid, and an original it cannot put back', () => {
    const granted = {bundleId: 'keybase.ios', service: 'photos' as const, state: 'granted' as const}
    expect(() => privacyRestoreArgs({...granted, bundleId: ''}, 'photos', UDID)).toThrow(/^refusing .*bundle id/)
    expect(() => privacyRestoreArgs({...granted, bundleId: 'all'}, 'photos', UDID)).toThrow(/^refusing .*bundle id/)
    expect(() => privacyRestoreArgs({...granted, bundleId: 'com.apple.mobileslideshow'}, 'photos', UDID)).toThrow(/^refusing .*bundle id/)
    expect(() => privacyRestoreArgs(granted, 'all' as 'photos', UDID)).toThrow(/^refusing /)
    expect(() => privacyRestoreArgs(granted, 'contacts' as 'photos', UDID)).toThrow(/^refusing /)
    expect(() => privacyRestoreArgs({...granted, service: 'photos-add'}, 'photos', UDID)).toThrow(/^refusing /)
    expect(() => privacyRestoreArgs(granted, 'photos', '')).toThrow(/^refusing .*udid/)
    expect(() => privacyRestoreArgs(granted, 'photos', 'iPhoneTest')).toThrow(/^refusing .*udid/)
    expect(() => privacyRestoreArgs({...granted, state: 'limited'}, 'photos', UDID)).toThrow(/^refusing .*limited/)
    expect(() => privacyGrantArgs('photos', UDID, 'all')).toThrow(/^refusing .*bundle id/)
    expect(() => privacyGrantArgs('photos', '', 'keybase.ios')).toThrow(/^refusing .*udid/)
    expect(() => privacyGrantArgs('all' as 'photos', UDID, 'keybase.ios')).toThrow(/^refusing /)
  })

  test('requireUdid takes a simulator udid only', () => {
    expect(requireUdid(UDID)).toBe(UDID)
    expect(() => requireUdid(undefined)).toThrow(/KB_IOS_UDID/)
    expect(() => requireUdid('iPhoneTest')).toThrow(/KB_IOS_UDID/)
  })
})

describe('restoring a permission', () => {
  const token = (state: 'granted' | 'denied' | 'unset' | 'not-in-tcc', service: 'photos' | 'location-always' = 'photos'): PrivacyRestore => ({
    done: false,
    original: {bundleId: 'keybase.ios', service, state},
    udid: UDID,
  })

  test('runs the restore once: a second call does nothing', () => {
    const ran: Array<ReadonlyArray<string>> = []
    let rows = [{authValue: 2, service: 'kTCCServicePhotos'}]
    const io = {read: () => rows, run: (a: ReadonlyArray<string>) => void ran.push(a)}
    const t = token('unset')
    restorePrivacyWith(t, {...io, run: a => {
      io.run(a)
      rows = []
    }})
    expect(ran).toEqual([['privacy', UDID, 'reset', 'photos', 'keybase.ios']])
    expect(t.done).toBe(true)
    restorePrivacyWith(t, io)
    expect(ran).toHaveLength(1)
    expect(gatePoisoned()).toBeUndefined()
  })

  test('checks before acting: a permission already at its original is left alone', () => {
    const ran: Array<ReadonlyArray<string>> = []
    const t = token('granted')
    restorePrivacyWith(t, {read: () => [{authValue: 2, service: 'kTCCServicePhotos'}], run: a => void ran.push(a)})
    expect(ran).toEqual([])
    expect(t.done).toBe(true)
  })

  test('location, which TCC does not keep, is always reset for keybase.ios', () => {
    const ran: Array<ReadonlyArray<string>> = []
    restorePrivacyWith(token('not-in-tcc', 'location-always'), {read: () => [], run: a => void ran.push(a)})
    expect(ran).toEqual([['privacy', UDID, 'reset', 'location-always', 'keybase.ios']])
  })

  test('a failed restore poisons the gate, names the simctl call to run by hand, and throws', () => {
    const t = token('denied')
    expect(() =>
      restorePrivacyWith(t, {
        read: () => [{authValue: 2, service: 'kTCCServicePhotos'}],
        run: () => {
          throw new Error('simctl exit 1')
        },
      })
    ).toThrow(/^restoring the photos permission for keybase\.ios failed: simctl exit 1/)
    expect(t.done).toBe(false)
    expect(gatePoisoned()).toMatch(/the photos permission for keybase\.ios \(run xcrun simctl privacy B338EAF5-6A0E-4CAF-BD25-446C674751FB revoke photos keybase\.ios\)/)
  })

  test('a restore that ran but did not take poisons the gate too', () => {
    const t = token('denied')
    expect(() => restorePrivacyWith(t, {read: () => [{authValue: 2, service: 'kTCCServicePhotos'}], run: () => {}})).toThrow(/still reads granted/)
    expect(gatePoisoned()).toMatch(/the photos permission/)
  })

  test('a failed read poisons the gate', () => {
    expect(() =>
      restorePrivacyWith(token('granted'), {
        read: () => {
          throw new Error('database is locked')
        },
        run: () => {},
      })
    ).toThrow(/database is locked/)
    expect(gatePoisoned()).toMatch(/the photos permission/)
  })

  test('a later restore that reads back clears the poison', () => {
    const t = token('denied')
    expect(() => restorePrivacyWith(t, {read: () => [{authValue: 2, service: 'kTCCServicePhotos'}], run: () => {}})).toThrow()
    expect(gatePoisoned()).toBeDefined()
    restorePrivacyWith(t, {read: () => [{authValue: 0, service: 'kTCCServicePhotos'}], run: () => {}})
    expect(gatePoisoned()).toBeUndefined()
  })
})

describe('the push payload', () => {
  const convID = '0000f0b5c2c2211c8d67ed15e75e656c7862d086e9245420892a7de62cd9ec58'
  const uid = '0123456789abcdef0123456789abcd19'
  const body = 'e2e-0abc12-push-fg-1a2b3c4d'

  test('is a chat.newmessage for one conversation and uid, with the stamped body and nothing else', () => {
    const p = chatNewMessagePayload({body, convID, uid})
    expect(p).toEqual({aps: {alert: {body, title: 'e2e'}, sound: 'default'}, convID, m: '', t: '1', type: 'chat.newmessage', uid})
    expect(requireTappablePush(p)).toBe(p)
  })

  test('holds no name: a body that is not a stamped push marker is refused, as are ids that are not ids', () => {
    expect(() => chatNewMessagePayload({body: 'hi testuser', convID, uid})).toThrow(/^refusing /)
    expect(() => chatNewMessagePayload({body: 'e2e-0abc12-share-x', convID, uid})).toThrow(/^refusing /)
    expect(() => chatNewMessagePayload({body, convID: 'testuser', uid})).toThrow(/^refusing /)
    expect(() => chatNewMessagePayload({body, convID, uid: 'testuser'})).toThrow(/^refusing /)
  })

  test('refuses a silent type, content-available, or any extra field', () => {
    const p = chatNewMessagePayload({body, convID, uid})
    expect(() => requireTappablePush({...p, type: 'chat.newmessageSilent_2'})).toThrow(/^refusing .*chat\.newmessage/)
    expect(() => requireTappablePush({...p, type: 'chat.readmessage'})).toThrow(/^refusing /)
    expect(() => requireTappablePush({...p, aps: {...p.aps, 'content-available': 1} as typeof p.aps})).toThrow(/^refusing /)
    expect(() => requireTappablePush({...p, c: convID} as typeof p)).toThrow(/^refusing /)
    expect(() => requireTappablePush({...p, aps: {...p.aps, alert: {...p.aps.alert, body: 'hi testuser'}}})).toThrow(/^refusing /)
  })
})

describe('the photo corpus', () => {
  const item = (name: string, sha256: string) => ({name, sha256})

  test('adds only what the simulator has not had added', () => {
    const wanted = [item('e2e-c.png', 'a'), item('e2e-c.jpg', 'b'), item('e2e-c.mp4', 'c')]
    expect(corpusDiff([], wanted)).toEqual(wanted)
    expect(corpusDiff([item('e2e-c.jpg', 'b')], wanted)).toEqual([item('e2e-c.png', 'a'), item('e2e-c.mp4', 'c')])
  })

  test('never re-adds a recorded item, even under another name', () => {
    const wanted = [item('e2e-c.png', 'a')]
    expect(corpusDiff([item('e2e-c.png', 'a')], wanted)).toEqual([])
    expect(corpusDiff([item('renamed.png', 'a')], wanted)).toEqual([])
  })

  test('a corpus file whose bytes changed is a new item', () => {
    expect(corpusDiff([item('e2e-c.png', 'a')], [item('e2e-c.png', 'z')])).toEqual([item('e2e-c.png', 'z')])
  })
})

describe("the photo corpus after the simulator's data changes", () => {
  const wanted = [{name: 'e2e-c.png', sha256: 'a'}, {name: 'e2e-c.jpg', sha256: 'b'}]

  test('the same data adds only what is missing', () => {
    expect(corpusToAdd({data: 111, items: [wanted[0]!]}, 111, wanted)).toEqual([wanted[1]])
    expect(corpusToAdd({data: 111, items: wanted}, 111, wanted)).toEqual([])
  })

  test('new data (an erase) adds the whole corpus again, as does a simulator never recorded', () => {
    expect(corpusToAdd({data: 111, items: wanted}, 222, wanted)).toEqual(wanted)
    expect(corpusToAdd(undefined, 222, wanted)).toEqual(wanted)
  })
})
