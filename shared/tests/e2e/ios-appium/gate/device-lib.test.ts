import {
  chatNewMessagePayload,
  corpusDiff,
  corpusToAdd,
  parseLocationd,
  parseTcc,
  privacyGrantArgs,
  privacyOriginal,
  privacyRestoreArgs,
  requireUdid,
  restorePrivacyWith,
  type PrivacyRestore,
  type TccRow,
} from './device-lib'
import {clearGatePoison, gatePoisoned} from './poison-lib'

const UDID = '00000000-1111-2222-3333-444444444444'
const snap = (tcc: ReadonlyArray<TccRow>, locationAuth?: number) => ({locationAuth, tcc})
const photos = (authValue: number) => snap([{authValue, service: 'kTCCServicePhotos'}])

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

  test('reads the original of each photo service: allowed, denied, never asked, limited', () => {
    const rows = snap(parseTcc('[{"service":"kTCCServicePhotos","auth_value":2},{"service":"kTCCServicePhotosAdd","auth_value":0}]'))
    expect(privacyOriginal(rows, 'photos')).toEqual({bundleId: 'keybase.ios', service: 'photos', state: 'granted'})
    expect(privacyOriginal(rows, 'photos-add')).toEqual({bundleId: 'keybase.ios', service: 'photos-add', state: 'denied'})
    expect(privacyOriginal(snap([]), 'photos')).toEqual({bundleId: 'keybase.ios', service: 'photos', state: 'unset'})
    expect(privacyOriginal(photos(3), 'photos').state).toBe('limited')
    expect(() => privacyOriginal(snap([{authValue: 2, service: 'kTCCServicePhotos'}, {authValue: 0, service: 'kTCCServicePhotos'}]), 'photos')).toThrow(
      /more than one/
    )
  })

  test("reads location's original from locationd: never asked, denied, and granted at the level named", () => {
    expect(privacyOriginal(snap([]), 'location-always').state).toBe('unset')
    expect(privacyOriginal(snap([], 1), 'location').state).toBe('denied')
    expect(privacyOriginal(snap([], 2), 'location').state).toBe('granted')
    expect(privacyOriginal(snap([], 4), 'location-always').state).toBe('granted')
    expect(() => privacyOriginal(snap([], 4), 'location')).toThrow(/cannot put back as location$/)
    expect(() => privacyOriginal(snap([], 2), 'location-always')).toThrow(/cannot put back as location-always$/)
    expect(() => privacyOriginal(snap([], 3), 'location')).toThrow(/authorization 3/)
  })
})

describe("locationd's clients.plist", () => {
  const entry = (body: string) => `<dict>
	<key>ikeybase.ios.KeybaseShare:</key>
	<dict><key>Authorization</key><integer>4</integer></dict>
	<key>ikeybase.ios:</key>
	<dict>
		<key>BackgroundLocationCapability</key>
		<true/>${body}
		<key>PluginBundleIds</key>
		<array><string>keybase.ios.KeybaseShare</string></array>
	</dict>
	<key>icom.apple.Maps:</key>
	<dict><key>Authorization</key><integer>2</integer></dict>
</dict>`

  test("reads keybase.ios's own Authorization, never another client's", () => {
    expect(parseLocationd(entry('\n\t\t<key>Authorization</key>\n\t\t<integer>1</integer>'))).toBe(1)
    expect(parseLocationd(entry('\n\t\t<key>Authorization</key><integer>4</integer>'))).toBe(4)
  })

  test('no Authorization in its entry, or no entry, is never asked', () => {
    expect(parseLocationd(entry(''))).toBeUndefined()
    expect(parseLocationd('<dict><key>icom.apple.Maps:</key><dict><key>Authorization</key><integer>2</integer></dict></dict>')).toBeUndefined()
  })

  test('an Authorization in a dict nested in its entry is not its own', () => {
    expect(parseLocationd(entry('<key>Sub</key><dict><key>Authorization</key><integer>2</integer></dict>'))).toBeUndefined()
  })

  test('refuses an entry that is not one closed dict', () => {
    expect(() => parseLocationd('<key>ikeybase.ios:</key><string>x</string>')).toThrow(/not a dict/)
    expect(() => parseLocationd('<key>ikeybase.ios:</key><dict><key>Authorization</key><integer>2</integer>')).toThrow(/does not close/)
    expect(() => parseLocationd(`${entry('')}${entry('')}`)).toThrow(/more than one/)
  })
})

describe('simctl privacy argv', () => {
  test('a grant names the udid, the service and keybase.ios', () => {
    expect(privacyGrantArgs('location-always', UDID, 'keybase.ios')).toEqual(['privacy', UDID, 'grant', 'location-always', 'keybase.ios'])
  })

  test('a restore puts back exactly what was there: grant, revoke or reset, always for keybase.ios', () => {
    const o = (state: 'granted' | 'denied' | 'unset') => ({bundleId: 'keybase.ios', service: 'photos' as const, state})
    expect(privacyRestoreArgs(o('granted'), 'photos', UDID)).toEqual(['privacy', UDID, 'grant', 'photos', 'keybase.ios'])
    expect(privacyRestoreArgs(o('denied'), 'photos', UDID)).toEqual(['privacy', UDID, 'revoke', 'photos', 'keybase.ios'])
    expect(privacyRestoreArgs(o('unset'), 'photos', UDID)).toEqual(['privacy', UDID, 'reset', 'photos', 'keybase.ios'])
    expect(privacyRestoreArgs({bundleId: 'keybase.ios', service: 'location', state: 'unset'}, 'location', UDID)).toEqual([
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
  const token = (state: 'granted' | 'denied' | 'unset', service: 'photos' | 'location-always' = 'photos'): PrivacyRestore => ({
    done: false,
    original: {bundleId: 'keybase.ios', service, state},
    udid: UDID,
  })
  // one look: the restore reads back as taken now, or not
  const oneLook = async (taken: () => boolean) => Promise.resolve(taken())

  test('runs the restore once: a second call does nothing', async () => {
    const ran: Array<ReadonlyArray<string>> = []
    let rows = [{authValue: 2, service: 'kTCCServicePhotos'}]
    const io = {read: () => snap(rows), readBack: oneLook, run: (a: ReadonlyArray<string>) => void ran.push(a)}
    const t = token('unset')
    expect(
      await restorePrivacyWith(t, {
        ...io,
        run: a => {
          io.run(a)
          rows = []
        },
      })
    ).toBe(true)
    expect(ran).toEqual([['privacy', UDID, 'reset', 'photos', 'keybase.ios']])
    expect(t.done).toBe(true)
    expect(await restorePrivacyWith(t, io)).toBe(false)
    expect(ran).toHaveLength(1)
    expect(gatePoisoned()).toBeUndefined()
  })

  test('checks before acting: a permission already at its original is left alone', async () => {
    const ran: Array<ReadonlyArray<string>> = []
    const t = token('granted')
    expect(await restorePrivacyWith(t, {read: () => photos(2), readBack: oneLook, run: a => void ran.push(a)})).toBe(false)
    expect(ran).toEqual([])
    expect(t.done).toBe(true)
  })

  test("location is reset and read back from locationd, even from a level its original can't hold", async () => {
    for (const before of [4, 2]) {
      const ran: Array<ReadonlyArray<string>> = []
      let auth: number | undefined = before
      await restorePrivacyWith(token('unset', 'location-always'), {
        read: () => snap([], auth),
        readBack: oneLook,
        run: a => {
          ran.push(a)
          auth = undefined
        },
      })
      expect(ran).toEqual([['privacy', UDID, 'reset', 'location-always', 'keybase.ios']])
    }
    expect(gatePoisoned()).toBeUndefined()
  })

  test('the read-back is polled: a reset locationd writes a few reads late still takes', async () => {
    let reads = 0
    let looks = 0
    let reset = false
    const t = token('unset', 'location-always')
    await restorePrivacyWith(t, {
      // locationd has written the reset by the third read after it ran
      read: () => snap([], reset && ++reads >= 3 ? undefined : 4),
      readBack: async taken => {
        for (; looks < 5; looks++) if (taken()) return Promise.resolve(true)
        return Promise.resolve(false)
      },
      run: () => {
        reset = true
      },
    })
    expect(looks).toBe(2)
    expect(t.done).toBe(true)
    expect(gatePoisoned()).toBeUndefined()
  })

  test('a location reset that did not take poisons the gate', async () => {
    await expect(restorePrivacyWith(token('unset', 'location-always'), {read: () => snap([], 4), readBack: oneLook, run: () => {}})).rejects.toThrow(
      /still reads granted, not unset/
    )
    expect(gatePoisoned()).toMatch(/the location-always permission/)
  })

  test('a failed restore poisons the gate, names the simctl call to run by hand, and throws', async () => {
    const t = token('denied')
    await expect(
      restorePrivacyWith(t, {
        read: () => photos(2),
        readBack: oneLook,
        run: () => {
          throw new Error('simctl exit 1')
        },
      })
    ).rejects.toThrow(/^restoring the photos permission for keybase\.ios failed: simctl exit 1/)
    expect(t.done).toBe(false)
    expect(gatePoisoned()).toMatch(/the photos permission for keybase\.ios \(run xcrun simctl privacy 00000000-1111-2222-3333-444444444444 revoke photos keybase\.ios\)/)
  })

  test('a restore that ran but did not take poisons the gate too', async () => {
    const t = token('denied')
    await expect(restorePrivacyWith(t, {read: () => photos(2), readBack: oneLook, run: () => {}})).rejects.toThrow(/still reads granted/)
    expect(gatePoisoned()).toMatch(/the photos permission/)
  })

  test('a failed read poisons the gate', async () => {
    await expect(
      restorePrivacyWith(token('granted'), {
        read: () => {
          throw new Error('database is locked')
        },
        readBack: oneLook,
        run: () => {},
      })
    ).rejects.toThrow(/database is locked/)
    expect(gatePoisoned()).toMatch(/the photos permission/)
  })

  test('a later restore that reads back clears the poison', async () => {
    const t = token('denied')
    await expect(restorePrivacyWith(t, {read: () => photos(2), readBack: oneLook, run: () => {}})).rejects.toThrow()
    expect(gatePoisoned()).toBeDefined()
    await restorePrivacyWith(t, {read: () => photos(0), readBack: oneLook, run: () => {}})
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
  })

  test('holds no name: a body that is not a stamped push marker is refused, as are ids that are not ids', () => {
    expect(() => chatNewMessagePayload({body: 'hi testuser', convID, uid})).toThrow(/^refusing /)
    expect(() => chatNewMessagePayload({body: 'e2e-0abc12-share-x', convID, uid})).toThrow(/^refusing /)
    expect(() => chatNewMessagePayload({body, convID: 'testuser', uid})).toThrow(/^refusing /)
    expect(() => chatNewMessagePayload({body, convID, uid: 'testuser'})).toThrow(/^refusing /)
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
