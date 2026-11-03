// The profile screen, shared by the profile flows, and the photo picker images an avatar or emoji editor shows.
import {corpusEntry} from '../../fixtures/corpus/corpus'
import * as T from '../../shared/test-ids'
import {imageProps, openLink, pickedFiles} from '../gate/device'
import {waitForTestID} from './elements'
import {expectScreen} from '../gate/screens'
import {fiberPrelude} from './fiber-prelude'
import {jsEval, waitFor} from './lifecycle'
import {check} from './menus'
import {escapeToTabs} from './navigate'

// the profile's "Add more identities" button, drawn below its identity rows
export const ADD_IDENTITIES = '-ios predicate string:type == "XCUIElementTypeButton" AND label == "Add more identities" AND visible == 1'

// `username`'s own profile (the account the app is on), opened from a link; `who` names it in the
// screen wait ("the smoke account"). Bound: escapeToTabs 30, the link 1, screen 21, the page 11 = 63.
export const openOwnProfileOf = async (username: string, who: string) => {
  await escapeToTabs()
  openLink(`keybase://profile/show/${username}`)
  await expectScreen(`${who}'s own profile`, 'profile', p => p['username'] === username, 20_000)
  await waitForTestID(T.PROFILE_PAGE, 10_000)
}

// The files of the app's photo picker cache that the screens up draw as images (a Kb.Image whose src
// is one), each once: what an avatar editor or an emoji's row was handed by the photo picker. Reads
// the app's tree; sends nothing. Bound: one read 1.
export const pickedImagesShown = async () =>
  jsEval<Array<string>>(`${fiberPrelude}
    const urls = new Set()
    const stack = [e2eRootFiber()]
    while (stack.length) {
      const f = stack.pop()
      if (f.sibling) stack.push(f.sibling)
      if (f.child) stack.push(f.child)
      const src = f.memoizedProps && f.memoizedProps.src
      if (typeof src === 'string' && src.startsWith('file://') && src.includes('/Library/Caches/ImagePicker/')) urls.add(src)
    }
    return [...urls]`)

// The one photo-picker file the screen up shows, once it shows it (and, given `uri`, once that is it),
// proven to be the corpus png: the copy is re-encoded, and the corpus png, jpg and heic are all 64x48,
// so its format and pixel size together are the png alone. Bound: shown 11 (10, one read 1), picked
// 121 (its container lookup 120), pixels 30 = 162.
export const requirePickedPng = async (what: string, uri?: string) => {
  const shown = await waitFor(
    what,
    async () => {
      const urls = await pickedImagesShown()
      if (urls.length > 1) throw new Error(`${what}: the screen shows ${urls.length} picked images, not one`)
      return uri === undefined || urls[0] === uri ? urls[0] : undefined
    },
    {interval: 500, timeout: 10_000}
  )
  const [picked] = pickedFiles([shown])
  const got = imageProps(picked!.path)
  check(got.format === 'png' && got.pixels === imageProps(corpusEntry('e2e-c.png').file).pixels, 'the picked image is not the corpus png')
}
