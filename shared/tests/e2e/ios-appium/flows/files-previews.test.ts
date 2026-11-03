// What the phone draws for a file opened from its row, one corpus file per kind (a picture, a video,
// a PDF, a text) in a work folder of the smoke account's private folder that the host makes for the
// test (e2e-<runid>-files-<hex>, with the files under stamped names that keep the corpus extension).
// Each row is tapped to open the file's preview screen aimed at that file, and the preview of its
// kind must be drawn (loaded: the picture drawn, the video player, the PDF viewer loaded, the text in)
// and none of the other kinds'. The text preview must show the corpus file's first line.
//
// No download step: the phone has no regular download. The work folder is deleted by the flow's
// afterEach, after a timeout too.
import * as fs from 'fs'
import {corpusEntry} from '../../fixtures/corpus/corpus'
import {withCleanup} from '../../shared/cleanup.ts'
import {kbfsCopyIn, kbfsMkdir, newWorkFolder, removeOwnKbfs, requireOwnPath, stampedEntry} from '../../shared/files.ts'
import * as T from '../../shared/test-ids'
import {retriedNavigation, step} from '../gate/step'
import {el} from '../helpers/elements'
import {filesRowNamed, openFolder} from '../helpers/files'
import {expectScreen, visibleScreen} from '../gate/screens'
import {waitFor} from '../helpers/lifecycle'
import {check, tapFrame} from '../helpers/menus'
import {escapeToTabs, goBack} from '../helpers/navigate'

type Kind = {corpus: string; label: string; testID: string}
const KINDS: ReadonlyArray<Kind> = [
  {corpus: 'e2e-c.png', label: 'pvimg', testID: T.FILES_IMAGE_PREVIEW},
  {corpus: 'e2e-c.mp4', label: 'pvvid', testID: T.FILES_VIDEO_PREVIEW},
  {corpus: 'e2e-c.pdf', label: 'pvpdf', testID: T.FILES_PDF_PREVIEW},
  {corpus: 'e2e-c.txt', label: 'pvtxt', testID: T.FILES_TEXT_PREVIEW},
]

describe('files previews', function () {
  // work folders the host made for the test
  const madePaths = new Set<string>()

  // Bound: 195 a path (its listing 60, whoami 15, the delete 60, the listing 60).
  const removeMadePaths = async () => {
    for (const p of [...madePaths]) {
      await removeOwnKbfs(p)
      madePaths.delete(p)
    }
  }

  // Back from a file's preview to its folder (pushed above the tab bar). Bound: 30s of tries, overrun
  // by one (the back 3, the screen 5 and its read 1) = 39.
  const backToFolder = async (folder: string) =>
    retriedNavigation(
      'back to the work folder',
      async () => {
        const s = await visibleScreen()
        if (!(s?.name === 'fsBrowse' && s.params?.['path'] === folder)) await goBack()
        await expectScreen('the work folder', 'fsBrowse', p => p['path'] === folder, 5_000)
      },
      {intervals: [500], timeout: 30_000}
    )

  // The work folder the host made is deleted whatever the test did. Worst case (s): the folder 195,
  // escape 30 = 225.
  afterEach(async function () {
    this.timeout(300_000)
    await withCleanup(removeMadePaths, [escapeToTabs])
  })

  it('opening a picture, a video, a PDF and a text shows the preview of its kind', async function () {
    // worst case (s): work 300 (the folder 60 and 60 for each of the four files), open 365 (the root
    // 56, the type row 31, its tap 1 and screen 11, then two levels of the row 121, its tap 1 and
    // screen 11), the four rows drawn 484 (121 each), then for each kind 148 (its row 31, the tap 1,
    // the screen 11, the aim check 1, its preview 60, the other three kinds' absence 3, step 2, back
    // 39) = 592 and for the text its first line 16 (15, one read 1) = 4 * 148 + 16 = 608; = 1757
    this.timeout(1_800_000)
    const folder = newWorkFolder()
    madePaths.add(folder)
    await kbfsMkdir(folder)
    const made = new Map<string, string>()
    for (const k of KINDS) {
      const name = stampedEntry(k.label)
      const ext = k.corpus.slice(k.corpus.lastIndexOf('.'))
      made.set(k.label, name)
      await kbfsCopyIn(corpusEntry(k.corpus).file, `${folder}/${name}${ext}`)
    }
    const firstLine = fs.readFileSync(corpusEntry('e2e-c.txt').file, 'utf8').split('\n')[0]!.trim()
    check(firstLine.length > 0, 'the corpus text file has no first line')

    await openFolder(folder, 120_000)
    for (const k of KINDS) await filesRowNamed(made.get(k.label)!, 'a file the host put in the work folder', {timeout: 120_000})

    for (const k of KINDS) {
      const name = made.get(k.label)!
      const ext = k.corpus.slice(k.corpus.lastIndexOf('.'))
      const path = `${folder}/${name}${ext}`
      const row = await filesRowNamed(name, 'the file row')
      await tapFrame(row.rect, "the file row")
      const aimed = (p: Record<string, unknown>) => p['path'] === path && requireOwnPath(path) === path
      await expectScreen('the preview of the file tapped', 'fsFilePreview', aimed)
      await el(k.testID).waitForExist({timeout: 60_000})
      for (const other of KINDS) {
        if (other.testID === k.testID) continue
        check(!(await el(other.testID).isExisting()), 'a preview of another kind is drawn too')
      }
      if (k.testID === T.FILES_TEXT_PREVIEW) {
        // the preview draws the file as one text, its label the whole file (ending in its newline)
        await waitFor(
          "the text preview's first line",
          async () => {
            for (const e of await browser.$$(`-ios predicate string:type == "XCUIElementTypeStaticText" AND label BEGINSWITH ${JSON.stringify(firstLine)}`).getElements()) {
              if (((await e.getAttribute('label').catch(() => null)) ?? '').split('\n')[0]!.trim() === firstLine) return true
            }
            return undefined
          },
          {interval: 500, timeout: 15_000}
        )
      }
      await step(`Preview of the ${k.label}`, {card: k.testID === T.FILES_IMAGE_PREVIEW})
      await backToFolder(folder)
    }
  })
})
