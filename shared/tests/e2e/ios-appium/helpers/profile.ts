// The profile screen, shared by the profile flows, and the photo picker images an avatar or emoji editor shows.
import * as T from '../../shared/test-ids'
import {openLink} from '../gate/device'
import {waitForTestID} from './elements'
import {expectScreen} from '../gate/screens'
import {fiberPrelude} from './fiber-prelude'
import {jsEval} from './lifecycle'
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
