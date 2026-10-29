// The smoke account's avatar: saved straight after picking (the default path), and saved after
// zooming the crop. An avatar cannot be put back as it was, so each test always uploads the same
// corpus image.
import type {Page, TestInfo} from '@playwright/test'
import {loadE2EAccounts} from '@/tests/e2e/accounts/env'
import {clickUnoccluded} from '@/tests/e2e/electron/helpers/chat'
import {withCleanup} from '@/tests/e2e/electron/helpers/cleanup'
import {dropFiles} from '@/tests/e2e/electron/helpers/drop'
import {expect, test} from '@/tests/e2e/electron/helpers/fixtures'
import {closeLeftoverModals} from '@/tests/e2e/electron/helpers/modal'
import {openOwnProfile} from '@/tests/e2e/electron/helpers/navigate'
import {visibleProfile} from '@/tests/e2e/electron/helpers/people'
import {step} from '@/tests/e2e/electron/helpers/step'
import {mainRead, modalButton, modalRoot, zoomAvatarCrop} from '@/tests/e2e/electron/helpers/teams'
import {CORPUS_DIR} from '@/tests/e2e/fixtures/corpus/corpus'
import * as T from '@/tests/e2e/shared/test-ids'

test.use({actionTimeout: 10_000})

type Avatars = {picmap?: Record<string, Record<string, string>> | null}

// The picked image in the avatar modal and its crop frame, on screen.
const cropBoxes = async (page: Page) => {
  const img = modalRoot(page).locator('img[src*="e2e-c"]').first()
  return Promise.all([img.boundingBox(), img.locator('xpath=..').boundingBox()])
}

// Whether the picked image covers its crop frame and sits centered in it.
const cropFillsFrame = async (page: Page) => {
  const [i, f] = await cropBoxes(page)
  if (!i || !f) return false
  const left = f.x - i.x
  const right = i.x + i.width - (f.x + f.width)
  const top = f.y - i.y
  const bottom = i.y + i.height - (f.y + f.height)
  return left >= -1 && right >= -1 && top >= -1 && bottom >= -1 && Math.abs(left - right) <= 1 && Math.abs(top - bottom) <= 1
}

// Whether the picked image runs past its crop frame on both axes: zoomed in from filling it.
const cropZoomedIn = async (page: Page) => {
  const [i, f] = await cropBoxes(page)
  return !!i && !!f && i.width > f.width * 1.1 && i.height > f.height * 1.1
}

const setAvatar = async (page: Page, testInfo: TestInfo, file: string, zoom: boolean) => {
  const {smokeUser} = loadE2EAccounts()
  const avatarUrl = async () => {
    const res = await mainRead<Avatars>('keybase.1.avatars.loadUserAvatars', {formats: ['square_192'], names: [smokeUser]})
    return res.picmap?.[smokeUser]?.['square_192'] ?? ''
  }
  const before = await avatarUrl()
  await withCleanup(
    async () => {
      await openOwnProfile(page)
      await clickUnoccluded(visibleProfile(page).locator('.avatar').filter({has: page.locator('.icon-gen-iconfont-edit')}).first())
      const dropZone = modalRoot(page).getByText('Drag and drop a profile avatar or', {exact: false})
      await expect(dropZone).toBeVisible({timeout: 10_000})
      // the picker is the page's own file input, not a native dialog: the image is dropped instead
      await dropFiles(page, modalRoot(page).locator('.icon-gen-iconfont-camera').first(), [file])
      await expect(modalRoot(page).getByText('Click to select. Scroll to zoom.', {exact: true})).toBeVisible({timeout: 15_000})
      if (zoom) {
        await zoomAvatarCrop(page)
        await expect.poll(async () => cropZoomedIn(page), {message: 'the crop zoomed in past filling the frame', timeout: 10_000}).toBe(true)
      } else {
        await expect.poll(async () => cropFillsFrame(page), {message: 'the picked image fills the crop, centered', timeout: 10_000}).toBe(true)
      }
      await step(page, testInfo, zoom ? 'avatar zoomed' : 'avatar picked')
      await modalButton(page, 'Save').click()
      await expect(modalRoot(page).getByTestId(T.MODAL_CLOSE), 'the avatar modal closed after Save').toHaveCount(0, {timeout: 30_000})
      await expect.poll(avatarUrl, {message: 'the avatar after Save', timeout: 60_000}).not.toBe(before)
      await step(page, testInfo, 'avatar saved', {card: true})
    },
    // the state the flow ended in, before the modal is closed
    [async () => step(page, testInfo, 'end state'), async () => closeLeftoverModals(page)]
  )
}

// saved as picked: no click or zoom on the crop first
test('set the avatar', async ({page}, testInfo) => {
  test.setTimeout(150_000)
  await setAvatar(page, testInfo, `${CORPUS_DIR}/e2e-c.png`, false)
})

test('set the avatar after zooming the crop', async ({page}, testInfo) => {
  test.setTimeout(150_000)
  await setAvatar(page, testInfo, `${CORPUS_DIR}/e2e-c-large.png`, true)
})
