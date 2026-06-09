import {expect} from '@wdio/globals'
import {requireSmokeUser} from '../helpers/app'
import {escapeToTabs, navigateToPeople} from '../helpers/navigate'
import {el, waitForTestID, byText} from '../helpers/elements'
import * as T from '../../shared/test-ids'

describe('people profile', () => {
  it('renders the feed and opens own profile when visible', async () => {
    const smokeUser = requireSmokeUser()
    await escapeToTabs()
    await navigateToPeople()
    await expect(el(T.PEOPLE_FEED)).toExist()

    // Your own username appearing in your own feed is genuinely conditional
    // (the feed surfaces others' activity), so guard rather than hard-wait.
    const userEl = byText(smokeUser)
    if (!(await userEl.isExisting())) return
    await userEl.click()
    await waitForTestID(T.PROFILE_PAGE, 10000)
    await expect(el(T.PROFILE_PAGE)).toExist()
  })
})
