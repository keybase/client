import {expect} from '@wdio/globals'
import {requireSmokeUser} from '../helpers/app'
import {escapeToTabs, navigateToPeople} from '../helpers/navigate'
import {byTextWithin, el, waitForTestID} from '../helpers/elements'
import * as T from '../../shared/test-ids'

describe('people profile', () => {
  it('renders the feed and opens own profile when visible', async () => {
    const smokeUser = requireSmokeUser()
    await escapeToTabs()
    await navigateToPeople()
    await expect(el(T.PEOPLE_FEED)).toExist()

    // Your own username appearing in your own feed is genuinely conditional
    // (the feed surfaces others' activity), so guard rather than hard-wait.
    //
    // Scoped to the feed, not matched across the screen: the People header's avatar carries the
    // username too, and tapping that opens the account switcher rather than a profile - which then
    // fails here on a missing profile page, and leaves a modal up for whatever runs next.
    // The feed container mounts empty and immediately, so waiting on it says nothing about whether
    // the feed has arrived. Wait for the row itself instead - a bounded wait rather than the retries
    // this flow used to carry, which re-ran the whole test to buy the same time.
    //
    // Rebuilt on every poll: a scoped element caches its parent's id, so a feed that re-renders
    // makes the scoped lookup throw stale forever, and the swallowed error reads as "not there".
    const findUser = () => byTextWithin(el(T.PEOPLE_FEED), smokeUser)
    const present = await browser
      .waitUntil(async () => findUser().isExisting().catch(() => false), {interval: 250, timeout: 10000})
      .then(() => true)
      .catch(() => false)
    if (!present) {
      console.log(`people profile: ${smokeUser} is not in its own feed, skipping the profile open`)
      return
    }
    const userEl = findUser()
    await userEl.click()
    await waitForTestID(T.PROFILE_PAGE, 10000)
    await expect(el(T.PROFILE_PAGE)).toExist()
  })
})
