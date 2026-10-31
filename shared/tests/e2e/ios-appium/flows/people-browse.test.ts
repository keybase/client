// What the People tab shows and leads to, read-only: the feed, the smoke account's own profile opened
// from a link, and the second account's profile reached from the header's search and its results.
// Nothing is followed or changed. The route's `username` param says whose profile is up, never the
// text of the row that was tapped.
import {loadE2EAccounts} from '../../accounts/env'
import * as T from '../../shared/test-ids'
import {requireSecondNotBlocked} from '../gate/blocks'
import {openLink} from '../gate/device'
import {step} from '../gate/step'
import {signedInAs} from '../helpers/chat'
import {el, waitForTestID} from '../helpers/elements'
import {expectScreen, fillField, filesRowNamed} from '../helpers/files'
import {check} from '../helpers/menus'
import {escapeToTabs, navigateToPeople} from '../helpers/navigate'
import {masked, onlyField, textShown} from '../helpers/teams'

describe('people browse', function () {
  before(async function () {
    // the second account is searched for and opened: a failed chat-blocks restore refuses here. The
    // host read 75s.
    this.timeout(90_000)
    await masked(async () => requireSecondNotBlocked())
  })

  it('the feed and the smoke account’s own profile', async function () {
    // worst case (s): escapeToTabs 30, the People tab 15, the feed 6, step 2, the account read 2, the
    // link 1, screen 21, the profile 11, step 2 = 90
    this.timeout(110_000)
    const {smokeUser} = loadE2EAccounts()
    await escapeToTabs()
    await navigateToPeople()
    await waitForTestID(T.PEOPLE_FEED, 5_000)
    // the feed suggests people who are not test accounts
    await step('The People feed', {screenshot: false})

    const who = await signedInAs()
    check(who.loggedIn && who.username === smokeUser, 'the phone is not signed in as the smoke account')
    openLink(`keybase://profile/show/${smokeUser}`)
    await expectScreen("the smoke account's own profile", 'profile', p => p['username'] === smokeUser, 20_000)
    await waitForTestID(T.PROFILE_PAGE, 10_000)
    await step('The own profile', {card: true})
  })

  it('the second account’s profile from the header’s search', async function () {
    // worst case (s): escapeToTabs 30, the People tab 15, step 2, the header's Search 6 and its tap 1,
    // screen 11, field 11, fill 26, row 16 (15, one drag 1), step 2, its tap 1, screen 11, the
    // profile 11, step 2 = 145
    this.timeout(165_000)
    const {secondUser} = loadE2EAccounts()
    await escapeToTabs()
    await navigateToPeople()
    // the feed suggests people who are not test accounts
    await step('The People feed', {screenshot: false})

    const search = await textShown('Search', "the People header's Search")
    await search.click()
    await expectScreen("the People tab's people search", 'peopleTeamBuilder')
    await fillField(await onlyField('TextField', "the people search's field"), secondUser, "the people search's field")
    const result = await filesRowNamed(secondUser, 'the second account among the results', {
      testID: T.TEAM_BUILDING_RESULT_ROW,
      timeout: 15_000,
    })
    // the search's results can hold people who are not test accounts
    await step('The second account among the results', {screenshot: false})
    await result.e.click()

    await expectScreen("the second account's profile", 'profile', p => p['username'] === secondUser)
    await el(T.PROFILE_PAGE).waitForExist({timeout: 10_000})
    await step('The second account’s profile', {card: true})
  })
})
