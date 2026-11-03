// The Files tab's root and its three folder types: the root (/keybase) lists private, public and
// team, each row found by its label opens that folder's screen, and back returns to the root. On a
// phone a folder is pushed above the tab bar, so back, not the tab, leads out of one; the tab tapped
// again at the root keeps it there. View only: nothing is written.
import * as T from '../../shared/test-ids'
import {step} from '../gate/step'
import {el, els, tab} from '../helpers/elements'
import {backToFilesRoot, expectFolder, filesRowNamed, openFilesRoot} from '../helpers/files'
import {expectScreen} from '../gate/screens'
import {tapFrame} from '../helpers/menus'
import {waitFor} from '../helpers/lifecycle'

const FOLDER_TYPES = ['private', 'public', 'team'] as const

describe('files browse', function () {
  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   root      openFilesRoot 56 (escapeToTabs 30, the tab 15, the screen 11);  rows  the three
  //             folder type rows, polled 10
  //   row       filesRowNamed 31 (30, one drag 1);  tap  1;  screen  10, plus one read 1 = 11
  //   browser   the folder's browser 10;  back  backToFilesRoot 39
  //   step      2 (its 1s settle and the attach)

  const threeRows = async () =>
    waitFor('the three folder type rows', async () => ((await els(T.FILES_TLF_ROW).length) === 3 ? true : undefined), {
      interval: 250,
      timeout: 10_000,
    })

  it('the Files tab lists private, public and team, and each opens its folder and backs out to the root', async function () {
    // worst case (s): root 56, rows 10, step 2 = 68; per folder type: row 31, tap 1, screen 11,
    // browser 10, step 2, back 39 = 94, three of them 282; the tab again: tap 1, screen 11, rows 10,
    // step 2 = 24; = 68 + 282 + 24 = 374
    this.timeout(400_000)
    await openFilesRoot()
    await threeRows()
    await step('The Files root lists the three folder types')

    for (const type of FOLDER_TYPES) {
      const row = await filesRowNamed(type, `the ${type} row`, {testID: T.FILES_TLF_ROW})
      await tapFrame(row.rect, `the ${type} row`)
      await expectFolder(`the ${type} folder`, `/keybase/${type}`)
      await el(T.FILES_BROWSER).waitForExist({timeout: 10_000})
      // a folder type's list holds the smoke account's folders shared with people and teams that are
      // not test ones
      await step(`Into the ${type} folder`, {screenshot: false})
      await backToFilesRoot()
    }

    await tab('Files').click()
    await expectScreen("the Files tab's root after a tap on its tab", 'fsRoot')
    await threeRows()
    await step('The Files tab tapped again stays on its root', {card: true})
  })
})
