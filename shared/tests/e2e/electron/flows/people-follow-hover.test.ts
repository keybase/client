// The profile's "Following" button reads "Unfollow" under the pointer. The smoke account's follow of
// the second account is read first and put back exactly after, read back from
// `keybase list-following`.
import {loadE2EAccounts} from '@/tests/e2e/accounts/env'
import {openUserProfile} from '@/tests/e2e/electron/helpers/chat'
import {withCleanup} from '@/tests/e2e/electron/helpers/cleanup'
import {expect, test} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToPeople} from '@/tests/e2e/electron/helpers/navigate'
import {button, expectFollowsSecond, followLabel, followsSecond, pressFollowChange, setFollowSecondFromCli, visibleProfile} from '@/tests/e2e/electron/helpers/people'
import {step} from '@/tests/e2e/electron/helpers/step'

test.use({actionTimeout: 10_000})

test('the Following button reads Unfollow on hover', async ({page}, testInfo) => {
  test.setTimeout(120_000)
  const original = await followsSecond()
  await setFollowSecondFromCli(false)
  await withCleanup(
    async () => {
      await openUserProfile(page, loadE2EAccounts().secondUser)
      const profile = visibleProfile(page)
      await pressFollowChange(page, true, "the profile's Follow", async () => followLabel(profile).click())
      await expectFollowsSecond(true, 'the second account in list-following after Follow')
      const following = button(profile, 'Following')
      await expect(following).toBeVisible({timeout: 15_000})
      await following.hover()
      await step(page, testInfo, 'hovering Following', {card: true})
      await expect(button(profile, 'Unfollow')).toBeVisible({timeout: 5_000})
    },
    // back to the People tab's root, so a later visit to the tab does not land on this profile
    [async () => setFollowSecondFromCli(original), async () => page.mouse.move(0, 0), async () => navigateToPeople(page)]
  )
})
