// The smoke account's own profile on the phone: its name, bio and location through Edit profile,
// set to this run's stamped values, read back from the server through the host and from the
// profile after a relaunch; and the proofs list, which "Add more identities" opens and its header's
// Cancel closes (proving an identity on an external site is manual-only). The fields are read on
// the host before the file runs, and the flow's afterEach puts them back exactly and reads them
// back (a no-op when they already are).
import {loadE2EAccounts} from '../../accounts/env'
import {withCleanup} from '../../shared/cleanup.ts'
import {profileFields, restoreProfileFields, type ProfileFields} from '../../shared/profile'
import {e2eRunId} from '../../shared/run-marker'
import * as T from '../../shared/test-ids'
import {requireAppIsSmoke} from '../gate/accounts'
import {creditSurface} from '../gate/attempt'
import {openLink, relaunchApp} from '../gate/device'
import {currentCallSeq, uiCallsSince, waitForUiCall} from '../gate/recorder'
import {manualEdge, step} from '../gate/step'
import {closeMessageMenu, dragUntilOnScreen} from '../helpers/chat'
import {el, waitForTestID} from '../helpers/elements'
import {expectScreen, fillField, tapButton, waitSignedIn} from '../helpers/files'
import {waitFor} from '../helpers/lifecycle'
import {check} from '../helpers/menus'
import {escapeToTabs} from '../helpers/navigate'
import {masked, textShown} from '../helpers/teams'

const PROFILE_EDIT = 'keybase.1.user.profileEdit'

const ADD_IDENTITIES = '-ios predicate string:type == "XCUIElementTypeButton" AND label == "Add more identities" AND visible == 1'
// the modal's header Cancel (a native bar item), not a Cancel in the screen's body
const HEADER_CANCEL = '-ios class chain:**/XCUIElementTypeNavigationBar/**/XCUIElementTypeButton[`label == "Cancel"`]'

describe('profile edit', function () {
  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   profile   openOwnProfile 63 (escapeToTabs 30, the link 1, screen 21, the page 11)
  //   host      profileFields 150 (whoami 15, four reads of 30, 5s apart);  polled  30s of reads,
  //             overrun by one 180
  //   button    tapButton 6 and its tap 1;  screen  a screen waited for 11 (10, read 1), 21 with a 20s
  //             wait;  field  its value waited for 11;  fill  fillField 26
  //   shown     a text on the profile 31 (30, one read 1);  identities  dragUntilOnScreen 20, its tap 1
  //   header    the header's Cancel 6 (5, its tap 1)
  //   relaunch  relaunchApp 200;  signed in  90;  account  1
  //   calls     one read 2;  waited for  12 (10, one read 2)
  //   step      2 (its 1s settle and the attach)

  // the smoke account's fields before the file; undefined until read
  let original: ProfileFields | undefined

  // -- what the afterEach puts back ---------------------------------------------------------------

  // Bound: restoreProfileFields: a read 150, the edit 60, 30s of reads overrun by one 180 = 390.
  const restoreFields = async () => {
    if (!original) return
    const want = original
    await masked(async () => restoreProfileFields(want))
  }

  before(async function () {
    // profileFields 150
    this.timeout(170_000)
    original = await masked(async () => profileFields())
  })

  // Worst case (s): close 19, restoreFields 390, escapeToTabs 30 = 439.
  afterEach(async function () {
    this.timeout(450_000)
    await withCleanup(closeMessageMenu, [restoreFields, escapeToTabs])
  })

  // -- reads --------------------------------------------------------------------------------------

  // The smoke account's own profile, opened from a link. Bound: 63.
  const openOwnProfile = async () => {
    const {smokeUser} = loadE2EAccounts()
    await escapeToTabs()
    openLink(`keybase://profile/show/${smokeUser}`)
    await expectScreen("the smoke account's own profile", 'profile', p => p['username'] === smokeUser, 20_000)
    await waitForTestID(T.PROFILE_PAGE, 10_000)
  }

  // Waits for the profile to draw `text` as one of its texts, read off one page source (an attribute
  // call per text of a profile with its teams and proofs took minutes, seen live: a read outlived its
  // wait). After a relaunch the profile can take a while to load. Bound: 30s, plus one read 1.
  const profileShows = async (text: string, what: string) => textShown(text, what, 30_000)

  // The field's value once the edit screen has put the loaded field in it. An empty field reads its
  // placeholder. Bound: 10s, plus one read 1.
  const fieldReads = async (testID: string, want: string, placeholder: string, what: string) =>
    waitFor(
      what,
      async () => {
        const field = el(testID)
        if (!(await field.isExisting())) return undefined
        const value = (await field.getAttribute('value').catch(() => null)) ?? ''
        return value === want || (want === '' && value === placeholder) ? true : undefined
      },
      {interval: 250, timeout: 10_000}
    )

  it('edit name, bio and location, read back on the server and after a relaunch', async function () {
    // worst case (s): profile 63, step 2, button 7, screen 11, field 11, fill 26 x3, step 2, calls 2,
    // button 7, waited for 12, calls 2, screen 21, polled 180, relaunch 200, signed in 90, account 1,
    // profile 63, shown 31 x3, step 2 = 847
    this.timeout(900_000)
    check(original !== undefined, 'the original profile fields were never read')
    const before = original!
    const runId = e2eRunId()
    const wanted: ProfileFields = {bio: `e2e-${runId}-bio`, fullName: `e2e-${runId}-name`, location: `e2e-${runId}-loc`}

    await openOwnProfile()
    await step('The own profile')
    await tapButton('Edit profile', "the profile's Edit profile")
    await expectScreen('Edit profile', 'profileEdit')
    // the screen has put the account's loaded name in, so what is typed next is not overwritten
    await fieldReads(T.PROFILE_EDIT_FULL_NAME, before.fullName, 'Full name', 'the loaded full name in its field')
    await fillField(() => el(T.PROFILE_EDIT_FULL_NAME), wanted.fullName, 'the full name field')
    await fillField(() => el(T.PROFILE_EDIT_BIO), wanted.bio, 'the bio field')
    await fillField(() => el(T.PROFILE_EDIT_LOCATION), wanted.location, 'the location field')
    await step('The new fields typed')

    const seq = await currentCallSeq()
    await tapButton('Save', "Edit profile's Save")
    await waitForUiCall('the profile edit to go out', seq, PROFILE_EDIT)
    check((await uiCallsSince(seq, PROFILE_EDIT)).length === 1, 'Save sent the profile edit more than once')
    await expectScreen("the own profile after Save", 'profile', p => p['username'] === loadE2EAccounts().smokeUser, 20_000)
    await masked(async () =>
      waitFor(
        'the new profile fields on the server',
        async () => {
          const f = await profileFields()
          return f.bio === wanted.bio && f.fullName === wanted.fullName && f.location === wanted.location ? true : undefined
        },
        {interval: 2_000, timeout: 30_000}
      )
    )

    // a relaunch reads the profile afresh
    await relaunchApp()
    await waitSignedIn()
    await requireAppIsSmoke()
    await openOwnProfile()
    await profileShows(wanted.fullName, 'the new full name on the profile after a relaunch')
    await profileShows(wanted.bio, 'the new bio on the profile after a relaunch')
    await profileShows(wanted.location, 'the new location on the profile after a relaunch')
    creditSurface('relaunch')
    await step('The new fields after a relaunch', {card: true})
  })

  it('the proofs list opens from Add more identities and closes by its header', async function () {
    // worst case (s): profile 63, identities 21, screen 11, the filter 11, step 2, header 6, screen 21,
    // step 2 = 137
    this.timeout(160_000)
    const {smokeUser} = loadE2EAccounts()
    await openOwnProfile()
    await dragUntilOnScreen('"Add more identities"', () => browser.$(ADD_IDENTITIES))
    await browser.$(ADD_IDENTITIES).click()
    await expectScreen('the proofs list', 'profileProofsList')
    await waitForTestID(T.PROFILE_PROOFS_FILTER, 10_000)
    // proving an identity on an external site is done by hand; no platform is picked here
    await manualEdge('external-proofs')

    await browser.$(HEADER_CANCEL).waitForExist({timeout: 5_000})
    await browser.$(HEADER_CANCEL).click()
    await expectScreen('the own profile after the proofs list closed', 'profile', p => p['username'] === smokeUser, 20_000)
    check(!(await el(T.PROFILE_PROOFS_FILTER).isExisting()), 'the proofs list is still drawn after its Cancel')
    await step('Back on the own profile')
  })
})
