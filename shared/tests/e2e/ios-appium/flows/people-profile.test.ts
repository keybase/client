import {expect} from '@wdio/globals'
import {requireSmokeUser} from '../helpers/app'
import {escapeToTabs, navigateToPeople} from '../helpers/navigate'
import {el, waitForTestID, byText} from '../helpers/elements'
import * as T from '../../shared/test-ids'

describe('people profile', () => {
  it('renders the people feed', async () => {
    await escapeToTabs()
    await navigateToPeople()
    await expect(el(T.PEOPLE_FEED)).toExist()
  })

  it('opens own profile from the feed when visible', async () => {
    const smokeUser = requireSmokeUser()
    await escapeToTabs()
    await navigateToPeople()
    await waitForTestID(T.PEOPLE_FEED, 3000)

    const userEl = byText(smokeUser)
    await userEl.waitForExist({timeout: 8000})
    await userEl.click()
    await waitForTestID(T.PROFILE_PAGE, 10000)
    await expect(el(T.PROFILE_PAGE)).toExist()
  })
})
