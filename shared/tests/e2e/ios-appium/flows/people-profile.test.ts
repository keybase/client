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

    // Maestro: runFlow when visible text: "${KB_SMOKE_USER}" — legitimately-absent data guard
    const userEl = byText(smokeUser)
    if (!(await userEl.isExisting())) return // smoke user not visible in the feed
    await userEl.click()
    await waitForTestID(T.PROFILE_PAGE, 10000)
    await expect(el(T.PROFILE_PAGE)).toExist()

    await el(T.COMMON_BACK_BUTTON).click()
  })
})
