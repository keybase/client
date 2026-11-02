// The smoke account's avatar from the phone: its own profile's avatar opens the photo picker, the
// corpus png picked there opens the avatar editor, and Save uploads it; the server then answers a new
// avatar url. The pick is proven by the file the editor shows: the photo picker hands the app a
// re-encoded copy for an avatar, so it is matched to the png by the format its bytes say and its
// pixel size. An avatar cannot be put back as it was, so the flow always uploads the same corpus
// image and restores nothing (the desktop flow's precedent).
//
// The flow's afterEach closes a picker a test left up.
import {loadE2EAccounts} from '../../accounts/env'
import {CORPUS} from '../../fixtures/corpus/corpus'
import {withCleanup} from '../../shared/cleanup.ts'
import {smokeAvatarUrl} from '../../shared/profile'
import * as T from '../../shared/test-ids'
import {creditSurface} from '../gate/attempt'
import {ensurePhotoCorpus, imageProps, pickedFiles} from '../gate/device'
import {currentCallSeq, waitForUiCall} from '../gate/recorder'
import {step} from '../gate/step'
import {closeSystemPickers, pickOnePhoto} from '../gate/system-ui'
import {tapControlIn} from '../helpers/chat'
import {el} from '../helpers/elements'
import {expectScreen, tapButton} from '../helpers/files'
import {waitFor} from '../helpers/lifecycle'
import {check} from '../helpers/menus'
import {escapeToTabs} from '../helpers/navigate'
import {openOwnProfileOf, pickedImagesShown} from '../helpers/profile'
import {masked} from '../helpers/teams'

const UPLOAD_AVATAR = 'keybase.1.user.uploadUserAvatar'

const corpusPng = () => {
  const entry = CORPUS.find(c => c.name === 'e2e-c.png')
  if (!entry) throw new Error('the corpus has no e2e-c.png')
  return entry.file
}

describe('profile avatar', function () {
  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   corpus    ensurePhotoCorpus: one addmedia each when missing, 7 x 120 = 840 (0 once recorded)
  //   host      smokeAvatarUrl 150 (whoami 15, four reads of 30, 5s apart);  polled  60s of reads,
  //             overrun by one 210
  //   profile   openOwnProfileOf 63;  avatar  tapControlIn 5;  pick  pickOnePhoto 58
  //   screen    a screen waited for 21 (20, read 1), 11 (10, read 1)
  //   shown     pickedImagesShown 1;  picked  pickedFiles 121 (its container lookup 120);  pixels
  //             imageProps twice 30
  //   button    tapButton 6;  calls  one read 2;  waited for  10
  //   step      2 (its 1s settle and the attach)
  //   cleanup   closeSystemPickers 45, escapeToTabs 30 = 75

  // Worst case (s): 75.
  afterEach(async function () {
    this.timeout(90_000)
    await withCleanup(closeSystemPickers, [escapeToTabs])
  })

  it('the avatar set from a corpus png picked in the photo picker', async function () {
    // worst case (s): corpus 840, host 150, profile 63, step 2, avatar 5, pick 58, screen 21, shown 1,
    // picked 121, pixels 30, step 2, calls 2, button 6, waited for 10, screen 11, polled 210, step 2 =
    // 1534
    this.timeout(1_560_000)
    const {smokeUser} = loadE2EAccounts()
    await ensurePhotoCorpus()
    const before = await masked(smokeAvatarUrl)
    await openOwnProfileOf(smokeUser, 'the smoke account')
    await step('The own profile')
    // the profile's avatar has no element of its own (its avatar and name are one): it is measured
    await tapControlIn(await el(T.PROFILE_AVATAR_NAME).getElement(), {prop: 'testID', value: T.PROFILE_AVATAR_NAME}, {handlerOf: 'onEditIcon'})
    await pickOnePhoto('e2e-c.png')
    const editor = await expectScreen(
      'the avatar editor with the picked photo',
      'profileEditAvatar',
      p => !p['teamID'] && typeof (p['image'] as {uri?: unknown} | undefined)?.uri === 'string',
      20_000
    )
    const uri = (editor.params?.['image'] as {uri: string}).uri
    const shown = await pickedImagesShown()
    check(shown.length === 1 && shown[0] === uri, "the avatar editor does not show the photo it was handed")
    // the copy is re-encoded, and the corpus png, jpg and heic are all 64x48: its format and pixel size
    // together are the png alone
    const [picked] = pickedFiles([uri])
    const got = imageProps(picked!.path)
    check(got.format === 'png' && got.pixels === imageProps(corpusPng()).pixels, 'the picked image is not the corpus png')
    creditSurface('photo-picker')
    await step('The picked png in the avatar editor')

    const seq = await currentCallSeq()
    await tapButton('Save', "the avatar editor's Save")
    await waitForUiCall('the avatar upload', seq, UPLOAD_AVATAR)
    await expectScreen('the own profile after Save', 'profile', p => p['username'] === smokeUser)
    await masked(async () =>
      waitFor(
        'the server to answer a new avatar',
        async () => {
          const now = await smokeAvatarUrl()
          return now !== '' && now !== before ? true : undefined
        },
        {interval: 3_000, timeout: 60_000}
      )
    )
    await step('The avatar saved', {card: true})
  })
})
