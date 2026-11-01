// The profile screen, shared by the profile flows.
import * as T from '../../shared/test-ids'
import {openLink} from '../gate/device'
import {waitForTestID} from './elements'
import {expectScreen} from './files'
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
