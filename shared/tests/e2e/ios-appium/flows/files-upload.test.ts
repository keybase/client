// Uploads from the phone into a Files folder, each through the folder header's Upload sheet into a
// work folder of the smoke account's private folder the host makes for the one test
// (e2e-<runid>-files-<hex>): the corpus png from "Upload photos/videos" (the photo picker), and the
// corpus pdf from "Upload file" (the document picker, from a folder of this run seeded in On My
// iPhone). The host then lists exactly one new file in the work folder, the size of the copy the
// picker handed the app (the upload keeps that copy's name). The photo picker hands the app a
// re-encoded copy for an upload, so the png is proven by the format its bytes say and its pixel
// size; the pdf copy is the corpus file itself (sha256).
//
// The flow's afterEach closes a picker a test left up, removes the seed folder and deletes the work
// folder.
import {corpusEntry} from '../../fixtures/corpus/corpus'
import {withCleanup} from '../../shared/cleanup.ts'
import {kbfsList, kbfsMkdir, newWorkFolder, removeOwnKbfs} from '../../shared/files.ts'
import * as T from '../../shared/test-ids'
import {creditSurface} from '../gate/attempt'
import {ensurePhotoCorpus, imageProps, pickerCacheFile, removeSeedFolder, seedDocumentFolder} from '../gate/device'
import type {PickerCache} from '../gate/picker-lib.ts'
import {currentCallSeq, waitForUiCall} from '../gate/recorder'
import {step} from '../gate/step'
import {closeSystemPickers, pickDocument, pickFromLibrary} from '../gate/system-ui'
import {fileSha} from '../helpers/chat'
import {expectFolder, openFolder, openFolderUploadSheet, pressTestID} from '../helpers/files'
import {waitFor} from '../helpers/lifecycle'
import {check} from '../helpers/menus'

const START_UPLOAD = 'keybase.1.SimpleFS.simpleFSStartUpload'

describe('files uploads from the phone', function () {
  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   work      the folder made 60;  open  openFolder 365 (its rows 120 each), the folder 11
  //   corpus    ensurePhotoCorpus: one addmedia each when missing, 7 x 120 = 840 (0 once recorded)
  //   sheet     openFolderUploadSheet 28;  row  pressTestID 12
  //   library   pickFromLibrary 66;  document  pickDocument 100;  seed  121 (its container lookup 120)
  //   calls     waitForUiCall 10
  //   host      uploadedAs 361 (180 of listings, overrun by one listing 60 and its copy read 121)
  //   pixels    imageProps twice 30
  //   step      2 (its 1s settle and the attach)
  //   cleanup   closeSystemPickers 45, the seed removal 120, the work folder 195 = 360

  // the work folder and the seed folder a test made, each cleared once removed
  let work: string | undefined
  let seeded: string | undefined

  // Worst case (s): 360.
  afterEach(async function () {
    this.timeout(380_000)
    await withCleanup(closeSystemPickers, [
      async () => {
        if (!seeded) return
        await removeSeedFolder(seeded)
        seeded = undefined
      },
      async () => {
        if (!work) return
        await removeOwnKbfs(work)
        work = undefined
      },
    ])
  })

  // A new work folder made by the host, open on the phone with its upload sheet up. Bound: work 60,
  // open 365, the folder 11, step 2, sheet 28 = 466.
  const uploadSheetIn = async () => {
    const folder = newWorkFolder()
    work = folder
    await kbfsMkdir(folder)
    await openFolder(folder, 120_000)
    await expectFolder('the work folder', folder)
    await step('The empty work folder')
    await openFolderUploadSheet()
    return folder
  }

  // The copy the picker handed the app, once the host lists it as the one file in `folder` (named as
  // the copy, at its size); any other entry fails. Bound: 180 of listings, overrun by one listing's
  // 60, each try's copy read 121 (its container lookup 120) = 361.
  const uploadedAs = async (folder: string, ext: string, cache: PickerCache) =>
    waitFor(
      'the host to list the uploaded file at its size',
      async () => {
        const entries = await kbfsList(folder)
        if (entries.length > 1) throw new Error(`the work folder holds ${entries.length} entries, not one`)
        const e = entries[0]
        if (!e) return undefined
        if (e.isDir || !e.name.endsWith(ext)) throw new Error('the work folder holds something other than the uploaded file')
        const picked = pickerCacheFile(cache, e.name)
        return e.size === picked.size ? picked : undefined
      },
      {interval: 3_000, timeout: 180_000}
    )

  it('a png from the photo library is uploaded into the folder', async function () {
    // worst case (s): corpus 840, sheet 466, row 12, library 66, calls 10, host 361, pixels 30, step
    // 2 = 1787
    this.timeout(1_820_000)
    await ensurePhotoCorpus()
    const folder = await uploadSheetIn()
    const seq = await currentCallSeq()
    await pressTestID(T.FILES_UPLOAD_MEDIA, "the upload sheet's Upload photos/videos")
    await pickFromLibrary(['e2e-c.png'])
    await waitForUiCall('the upload to start', seq, START_UPLOAD)
    const picked = await uploadedAs(folder, '.png', 'image')
    // The copy is re-encoded (its bytes and its decoded pixels both differ from the corpus file), so
    // no hash ties it to the png. Pixel size alone does not either: the corpus png, jpg and heic are
    // all 64x48. Nor does the .png the upload's name ends in, which is only the picker's naming of its
    // copy. The format read from the copy's bytes and the pixel size together are the png alone.
    const got = imageProps(picked.path)
    check(got.format === 'png' && got.pixels === imageProps(corpusEntry('e2e-c.png').file).pixels, 'the picked image is not the corpus png')
    creditSurface('photo-picker')
    await step('The png uploaded into the work folder', {card: true})
  })

  it('a pdf from a folder of the document picker is uploaded into the folder', async function () {
    // worst case (s): seed 121, sheet 466, row 12, document 100, calls 10, host 361, step 2 = 1072
    this.timeout(1_100_000)
    const pdf = corpusEntry('e2e-c.pdf').file
    seeded = seedDocumentFolder('upload', ['e2e-c.pdf'])
    const folder = await uploadSheetIn()
    const seq = await currentCallSeq()
    await pressTestID(T.FILES_UPLOAD_FILE, "the upload sheet's Upload file")
    await pickDocument(seeded, 'e2e-c.pdf')
    await waitForUiCall('the upload to start', seq, START_UPLOAD)
    const picked = await uploadedAs(folder, '.pdf', 'document')
    check(picked.sha256 === fileSha(pdf), 'the picked file is not the corpus pdf')
    creditSurface('file-picker')
    await step('The pdf uploaded into the work folder', {card: true})
  })
})
