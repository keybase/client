// The smoke account's own profile: its name, bio and location through Edit profile, read before and
// put back exactly after, read back from the server. The avatar is in profile-avatar.
import type {Page} from '@playwright/test'
import {withCleanup} from '@/tests/e2e/electron/helpers/cleanup'
import {e2eRunId, expect, test} from '@/tests/e2e/electron/helpers/fixtures'
import {closeLeftoverModals} from '@/tests/e2e/electron/helpers/modal'
import {openOwnProfile} from '@/tests/e2e/electron/helpers/navigate'
import {expectPersists} from '@/tests/e2e/electron/helpers/persisted'
import {visibleProfile} from '@/tests/e2e/electron/helpers/people'
import {step} from '@/tests/e2e/electron/helpers/step'
import {modalButton, modalRoot} from '@/tests/e2e/electron/helpers/teams'
import {mainRpc} from '@/tests/e2e/shared/main-rpc'
import {profileFields, type ProfileFields} from '@/tests/e2e/shared/profile'

test.describe.configure({mode: 'serial'})
test.use({actionTimeout: 10_000})

// The profile's own "Edit profile" button, not a proof row or the counts under the name.
const editProfileButton = (page: Page) =>
  visibleProfile(page).locator('.button--primary, .button--secondary').filter({hasText: /^Edit profile$/}).first()

test('edit name, bio and location', async ({page}, testInfo) => {
  test.setTimeout(150_000)
  const original = await profileFields()
  const wanted: ProfileFields = {bio: `e2e-${e2eRunId()}-bio`, fullName: `e2e-${e2eRunId()}-name`, location: `e2e-${e2eRunId()}-loc`}
  await withCleanup(
    async () => {
      await openOwnProfile(page)
      await editProfileButton(page).click()
      const fullName = modalRoot(page).getByPlaceholder('Full name')
      await expect(fullName).toHaveValue(original.fullName, {timeout: 10_000})
      await fullName.fill(wanted.fullName)
      await modalRoot(page).getByPlaceholder('Bio').fill(wanted.bio)
      await modalRoot(page).getByPlaceholder('Location').fill(wanted.location)
      await step(page, testInfo, 'edit profile filled')
      await modalButton(page, 'Save').click()
      await expect(fullName).toHaveCount(0, {timeout: 15_000})
      await expect.poll(profileFields, {message: 'the profile fields on the server after Save', timeout: 30_000}).toEqual(wanted)
      const shown = async () => {
        await openOwnProfile(page)
        const profile = visibleProfile(page)
        await expect(profile.getByText(wanted.bio, {exact: true})).toBeVisible({timeout: 15_000})
        return Promise.all(
          [wanted.fullName, wanted.bio, wanted.location].map(async t => profile.getByText(t, {exact: true}).first().isVisible())
        )
      }
      await expectPersists(page, shown, [true, true, true], 'the new name, bio and location on the profile')
      await step(page, testInfo, 'profile shows the new fields', {card: true})
    },
    [
      async () => {
        await mainRpc('keybase.1.user.profileEdit', original)
        await expect.poll(profileFields, {message: 'the original profile fields put back', timeout: 30_000}).toEqual(original)
      },
      async () => closeLeftoverModals(page),
    ]
  )
})
