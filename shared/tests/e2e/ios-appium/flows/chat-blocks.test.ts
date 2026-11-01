// Blocking the second account from the smoke account's DM with it, on the phone, and unblocking it
// from its profile. Nothing here ever reports: the block modal's report option is checked to be off
// before Finish, and the report submit is a manual edge.
//
// The host stays on the smoke account and reads every change back (the blocks, the DM's status, the
// smoke+second folder's favorite). The flow's afterEach puts back what a block changes, after a
// timeout too: it unblocks only if a block is still there, restores the DM's status and the folder's
// favorite, then runs the e2e accounts' own check. A restore that fails fails loudly, and every later
// flow that needs the second account refuses to run while the block is there (requireSecondNotBlocked).
// The gate registers this file last among the chat flows.
import {execFile} from 'child_process'
import path from 'path'
import {ensureChatData, type ChatData} from '../../shared/chat-data'
import {withCleanup} from '../../shared/cleanup.ts'
import {pairFavoriteState, refavoritePair, type PairFavoriteState} from '../../shared/favorites.ts'
import {conversationStatus, restoreConversationStatus} from '../../shared/main-rpc.ts'
import * as T from '../../shared/test-ids'
import {secondBlocks, unblockSecondOnHost} from '../gate/blocks'
import {secondBlockedProblem} from '../gate/blocks-lib'
import {openLink} from '../gate/device'
import {currentCallSeq, waitForUiCall} from '../gate/recorder'
import {manualEdge, step} from '../gate/step'
import {
  appInboxLists,
  closeMessageMenu,
  dragUntilOnScreen,
  hideKeyboard,
  iconButton,
  inboxHasRow,
  openConversation,
  openInfoPanel,
  scrollInboxTo,
  tapSwitchLabelled,
} from '../helpers/chat'
import {check} from '../helpers/menus'
import {convStatus, expectConvStatus, expectHost} from '../helpers/chat-host'
import {el} from '../helpers/elements'
import {appSnapshot, waitFor} from '../helpers/lifecycle'
import {escapeToTabs} from '../helpers/navigate'

describe('chat blocks', function () {
  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   open      openConversation 100;  row  scrollInboxTo 120;  absent  inboxHasRow 120 (the same scroll)
  //   panel     openInfoPanel 25 (the header menu 15, a tab 10);  on screen  dragUntilOnScreen 20
  //   blocks    the host's read of the blocks 75 (whoami 15, the call 60), polled 95 (20, overrun by
  //             one read);  conv  the host's read of a conversation 75, polled 95
  //   report    requireReportOff 21 (the row 10, a tap 1, the row again 10)
  //   calls     the recorder's call log, one read 2;  waited for  10
  //   profile   the link 1, the profile's screen 20, Manage blocking 10
  //   step      2 (its 1s settle and the attach)

  let data: ChatData
  before(async function () {
    this.timeout(20 * 60_000) // a first run seeds; later runs only check
    data = await ensureChatData()
  })

  // -- reads --------------------------------------------------------------------------------------

  const expectDirectStatus = async (what: string, want: number) => expectConvStatus(what, data.direct.convID, want)
  const expectBlocks = async (what: string, ok: (b: Awaited<ReturnType<typeof secondBlocks>>) => boolean) =>
    expectHost(what, secondBlocks, ok)

  // The block modal opens over the info panel's (or the profile's) screen, and XCUITest reports a
  // modal stacked on a modal not visible (visible="false" on its Cancel and Finish, seen live), so
  // the modal's own lookups leave visibility out: each matches one element of the modal.
  const finish = () => browser.$('-ios predicate string:type == "XCUIElementTypeButton" AND label == "Finish"')

  // The block modal's report option must be off before Finish. Its row's testID carries its state;
  // when it shows on, its label (which turns it off) is tapped, and the state is read again. The
  // label holds the account's name, so it is matched by its ends.
  const requireReportOff = async () => {
    const on = el(T.CHAT_BLOCK_REPORT_ON)
    const off = el(T.CHAT_BLOCK_REPORT_OFF)
    await waitFor('the report option in the block modal', async () => ((await on.isExisting()) || (await off.isExisting()) ? true : undefined), {
      interval: 250,
      timeout: 10_000,
    })
    if (await on.isExisting()) {
      const label = browser.$(
        '-ios predicate string:type == "XCUIElementTypeStaticText" AND label BEGINSWITH "Report " AND label ENDSWITH " to Keybase admins"'
      )
      await label.click()
    }
    await off.waitForExist({timeout: 10_000, timeoutMsg: 'the report option is not off'})
    check(!(await on.isExisting()), 'the report option is still on')
  }

  // -- what the afterEach puts back ---------------------------------------------------------------
  // Set before the block, and cleared once every restore and the accounts' check pass, so a second
  // run of the afterEach does them again only while one has not.

  let blockedFrom: {folder: PairFavoriteState; status: number} | undefined

  // Unblocks only while a block is there; through the host (the test body's own unblock is the
  // profile's), read back.
  const unblock = async () => {
    if (secondBlockedProblem(await secondBlocks())) await unblockSecondOnHost()
  }

  const restoreStatus = async (status: number) => {
    if ((await convStatus(data.direct.convID)) === status) return
    await restoreConversationStatus(data.direct.convID, status)
    await expectDirectStatus('the restored status of the DM', status)
  }

  // The block ignores the smoke+second folder, and unblocking leaves it ignored. The ignore can land
  // after the unblock, so the folder's state settles first (two reads alike, 1s apart). Then it goes
  // back to how it was: a folder ignored before stays ignored; any other is un-ignored, which the
  // service only does by favoriting it (it has no call back to "neither"), and a favorite is one again.
  const restoreFolder = async (folder: PairFavoriteState) => {
    let last = ''
    await waitFor(
      'the smoke+second folder favorite state to settle',
      async () => {
        const now = JSON.stringify(await pairFavoriteState())
        const settled = now === last
        last = now
        return settled ? true : undefined
      },
      {interval: 1_000, timeout: 20_000}
    )
    if (folder.ignored) return
    const before = await pairFavoriteState()
    if (before.ignored || (folder.favorite && !before.favorite)) await refavoritePair()
    const now = await pairFavoriteState()
    check(!now.ignored && (!folder.favorite || now.favorite), `the smoke+second folder after the restore: ${JSON.stringify(now)}`)
  }

  // the e2e accounts' own check, as the release runs it (from shared/)
  const sharedDir = path.resolve(__dirname, '../../../..')
  const accountsCheck = async () =>
    new Promise<string>((resolve, reject) => {
      execFile(
        process.execPath,
        ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', path.resolve(sharedDir, 'tests/e2e/accounts/setup.mts'), '--check'],
        {cwd: sharedDir, encoding: 'utf8', timeout: 120_000},
        (err, stdout, stderr) => (err ? reject(new Error(`accounts:setup --check failed: ${stdout}${stderr}`)) : resolve(stdout))
      )
    })

  const restoreAll = async () => {
    if (blockedFrom === undefined) return
    const {folder, status} = blockedFrom
    // each runs whether an earlier one threw; any failure fails loudly, leaving blockedFrom set
    await withCleanup(unblock, [async () => restoreStatus(status), async () => restoreFolder(folder), accountsCheck])
    blockedFrom = undefined
  }

  // Nothing the block changed left behind, after a timeout too. Worst case (s): the unblock 245 (a
  // read 75, the set 75, its read polled 20 and overrun by one read 75), the status 245 (a read 75,
  // the set 75, its poll 95), the folder 415 (the settling 20 overrun by one read 75, a read 75, the
  // refavorite 170 as the unblock's, the read after it 75), the accounts' check 120, close 19,
  // keyboard 5, escapeToTabs 30 = 1079.
  afterEach(async function () {
    this.timeout(1_100_000)
    await withCleanup(restoreAll, [closeMessageMenu, hideKeyboard, escapeToTabs])
  })

  it('the second account blocked from the DM leaves the inbox, and is unblocked from its profile', async function () {
    // worst case (s): blocks 75, conv 75, the folder 75, open 100, panel 25, on screen 20, the tap 1,
    // Finish 10, report 21, the manual edge 2, the seq 2, the tap 1, Finish gone 15, calls 10 twice
    // 20, blocks 95, conv 95, the inbox 10, row 120, absent 120, the layout 10, step 2 = 894;
    // escapeToTabs 30, the link 1, the profile 20, Manage blocking 10 and its tap 1, Finish 10, blocks
    // 75, two switches tapped and turned 18, report 21, the seq 2, the tap 1, Finish gone 15, calls 10,
    // blocks 95, step 2 = 311; = 1205
    this.timeout(1_240_000)
    const unblockedProblem = secondBlockedProblem(await secondBlocks())
    check(!unblockedProblem, `the second account must start unblocked: ${unblockedProblem}`)
    const status = await convStatus(data.direct.convID)
    check(status === conversationStatus.unfiled, 'the DM does not start unfiled (a failed restore left it hidden, muted or blocked)')
    blockedFrom = {folder: await pairFavoriteState(), status}

    await openConversation(data.direct.convID)
    await openInfoPanel(T.CHAT_INFO_PANEL_SETTINGS_TAB)
    const block = () => iconButton('Block')
    await dragUntilOnScreen('Block', block)
    await block().click()
    await finish().waitForExist({timeout: 10_000})
    await requireReportOff()
    await manualEdge('block-report-submit')
    let seq = await currentCallSeq()
    await finish().click()
    await finish().waitForExist({reverse: true, timeout: 15_000})
    await waitForUiCall('the blocks to go out', seq, 'keybase.1.user.setUserBlocks')
    await waitForUiCall('the blocked status to go out', seq, 'chat.1.local.SetConversationStatusLocal')
    await expectBlocks('the second account chat blocked', b => b.chatBlocked)
    await expectDirectStatus('the DM blocked', conversationStatus.blocked)
    // Finish goes to the inbox; the self conversation shows it loaded, so the DM's absence counts
    await el(T.CHAT_INBOX_LIST).waitForExist({timeout: 10_000})
    await scrollInboxTo(data.smokeUser)
    check(!(await inboxHasRow(data.secondUser)), 'the blocked DM is still in the inbox')
    await waitFor("the app's inbox layout to drop the DM", async () => (!(await appInboxLists(data.direct.convID)) ? true : undefined), {
      timeout: 10_000,
    })
    await step('Blocked: the DM is gone from the inbox', {screenshot: false})

    // the profile of a blocked account offers Manage blocking, which opens the same modal
    await escapeToTabs()
    openLink(`keybase://profile/show/${data.secondUser}`)
    await waitFor(
      "the second account's profile",
      async () => {
        const {screen} = await appSnapshot()
        return screen?.name === 'profile' && screen.params?.['username'] === data.secondUser ? true : undefined
      },
      {interval: 500, timeout: 20_000}
    )
    const manage = browser.$('-ios predicate string:type == "XCUIElementTypeButton" AND label == "Manage blocking" AND visible == 1')
    await manage.waitForExist({timeout: 10_000})
    await manage.click()
    await finish().waitForExist({timeout: 10_000})
    // each block still on is turned off by a tap on its switch, read in memory (it holds the name)
    const now = await secondBlocks()
    if (now.chatBlocked) check(await tapSwitchLabelled(`Block ${data.secondUser}`, await finish().getElement(), 'Finish'), "the modal's block option was not on")
    if (now.followBlocked) {
      check(await tapSwitchLabelled(`Hide ${data.secondUser} from your followers`, await finish().getElement(), 'Finish'), "the modal's followers option was not on")
    }
    await requireReportOff()
    seq = await currentCallSeq()
    await finish().click()
    await finish().waitForExist({reverse: true, timeout: 15_000})
    await waitForUiCall('the unblock to go out', seq, 'keybase.1.user.setUserBlocks')
    await expectBlocks('the second account unblocked', b => !b.chatBlocked && !b.followBlocked)
    await step('Unblocked from the profile')
  })
})
