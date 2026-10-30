// What the phone sends to file a conversation in the inbox: the DM with the second account hidden
// from its inbox row until a new message brings it back, muted and unmuted from its info panel, a
// team's channels marked read from KB_E2E_TEAM's header, the self conversation pinned and unpinned
// from its row, and the inbox filter and thread search finding what the run holds.
//
// The host stays on the smoke account: it reads every change back (the conversation's status, its
// read pointer, the pinned list in gregor) and makes and deletes the throwaway channel. The new
// message comes from the second account's peer service. Every body is stamped with the run id. What
// a test changes is put back by the flow's afterEach, after a timeout too, and read back: the DM's
// status, the pinned conversations, the throwaway channel.
import {loadE2EEnv} from '../../accounts/env'
import {
  E2E_CHANNELS,
  createThrowawayChannel,
  deleteThrowawayChannel,
  directConvIDFromCli,
  ensureChatData,
  type ChatData,
} from '../../shared/chat-data'
import {withCleanup} from '../../shared/cleanup.ts'
import {conversationStatus, mainConversation, mainRpc, restoreConversationStatus} from '../../shared/main-rpc.ts'
import {peerSender, sendWithRetry, type IncomingSender} from '../../shared/peer-actors'
import {e2eMarker} from '../../shared/run-marker'
import * as T from '../../shared/test-ids'
import {creditSurface} from '../gate/attempt'
import {requireSecondNotBlocked} from '../gate/blocks'
import {inNameSection, type Rect} from '../gate/chat-lib'
import {callsSince, currentCallSeq} from '../gate/recorder'
import {step} from '../gate/step'
import {
  appConversationMuted,
  appConversationPinned,
  check,
  chooseMenuItem,
  closeMessageMenu,
  closeSearch,
  expectPersists,
  hideKeyboard,
  inboxHasRow,
  openConversation,
  openInboxRowMenu,
  openInfoPanel,
  openMenuFrom,
  openThreadSearch,
  rowElement,
  scrollInboxTo,
  scrollInboxToTeamHeader,
  scrollInboxToTop,
  searchFor,
  searchOpen,
  sendMessage,
  signedInAs,
  storedMessageState,
  unreadCount,
  visibleConversation,
  waitForRow,
} from '../helpers/chat'
import {el} from '../helpers/elements'
import {waitFor} from '../helpers/lifecycle'
import {escapeToTabs, navigateToChat} from '../helpers/navigate'

describe('chat conversations', function () {
  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   open      openConversation 100;  row  scrollInboxTo 90;  absent  inboxHasRow 90 (the same
  //             scroll);  header  scrollInboxToTeamHeader 90;  top  the inbox at its top 90
  //   row menu  openInboxRowMenu 295 (an open sheet closed 5, three long presses of scrollInboxTo 90,
  //             the press 1 and the sheet 3, the menu's conversation read 1, closed 5);  item
  //             chooseMenuItem 20;
  //             gear  openMenuFrom 15
  //   conv      the host's read of a conversation 75 (whoami 15, the call 60), polled 95 (20, overrun
  //             by one read);  gregor  the host's gregor read 75, polled 95
  //   peer      the peer found 45 and a failing call's diagnosis 25 = 70;  peer send  sendWithRetry
  //             90 (30, overrun by one send's 60)
  //   app       a read of the app's store, polled 20;  badge  the app's unread count, polled 30
  //   calls     the recorder's call log, one read 2;  waited for  10
  //   panel     openInfoPanel 25 (the header menu 15, a tab 10);  switch  the mute switch 10
  //   relaunch  relaunchApp 200;  signed in  90
  //   channel   createThrowawayChannel 240;  delete  deleteThrowawayChannel 120
  //   sent      sendMessage 25;  id  a sent message's id 10;  keyboard  5
  //   search    openThreadSearch 15;  searchFor 80 (45, overrun by a retry's close 5, open 15 and its
  //             2s pause, and one counter wait 10)
  //   self      the self conversation's id from the host CLI 60
  //   step      2 (its 1s settle and the attach)

  let data: ChatData
  before(async function () {
    // a first run seeds (later runs only check) within 20 minutes, then the block check's host read 75s
    this.timeout(20 * 60_000 + 75_000)
    data = await ensureChatData()
    // the second account's messages need it unblocked: a failed chat-blocks restore refuses here
    await requireSecondNotBlocked()
  })

  // The second account's peer service, found by the first test that needs it.
  let peer: Promise<IncomingSender> | undefined
  const sender = async () => (peer ??= peerSender(loadE2EEnv()))

  // -- reads --------------------------------------------------------------------------------------

  const callsOf = async (seq: number, method: string) => (await callsSince(seq)).calls.filter(c => c.method === method)
  const waitForCall = async (what: string, seq: number, method: string) =>
    waitFor(what, async () => ((await callsOf(seq, method)).length > 0 ? true : undefined), {interval: 250, timeout: 10_000})

  const statusOf = async (convID: string) => (await mainConversation(convID)).info.status
  const expectStatus = async (what: string, convID: string, want: number) =>
    waitFor(`the host to read ${what}`, async () => ((await statusOf(convID)) === want ? true : undefined), {
      interval: 1_000,
      timeout: 20_000,
    })

  // Polls a read of the app's store until it answers `want`.
  const expectApp = async <V,>(what: string, read: () => Promise<V | undefined>, want: V, timeout = 20_000) =>
    waitFor(`the app to hold ${what}`, async () => ((await read()) === want ? true : undefined), {interval: 500, timeout})

  const waitSignedIn = async () =>
    waitFor(
      'the relaunched app to sign in',
      async () => {
        const s = await signedInAs().catch(() => undefined)
        return s?.loggedIn && !s.switching ? true : undefined
      },
      {interval: 1_000, timeout: 90_000}
    )

  // The conversations the smoke account pins to the top of its inbox, as the host reads them from
  // gregor (the server keeps them there, for every device).
  const pinnedCategory = 'chatPinnedConvs'
  type GregorState = {items?: Array<{item?: {body?: Uint8Array | null; category: string} | null}> | null}
  const pinnedConvs = async (): Promise<Array<string>> => {
    const state = await mainRpc<GregorState>('keybase.1.gregor.getState', {})
    const body = state.items?.find(i => i.item?.category === pinnedCategory)?.item?.body
    return body ? (JSON.parse(Buffer.from(body).toString('utf8')) as Array<string>) : []
  }
  const expectPinned = async (what: string, ok: (pinned: Array<string>) => boolean) =>
    waitFor(`the host to read ${what}`, async () => (ok(await pinnedConvs()) ? true : undefined), {
      interval: 1_000,
      timeout: 20_000,
    })

  // The info panel's Settings tab of the conversation the app shows, with its Mute switch drawn.
  const openSettings = async () => {
    await openInfoPanel(T.CHAT_INFO_PANEL_SETTINGS_TAB)
    await el(T.CHAT_INFO_PANEL_MUTE).waitForExist({timeout: 10_000})
  }

  // -- what the afterEach puts back ---------------------------------------------------------------
  // Each is set before the change it undoes and cleared once its restore reads back, so the restore
  // runs only when needed and a second run of it does nothing.

  // the status of each conversation whose row menu a test opened, before it did
  const statusesBefore = new Map<string, number>()
  // the pinned conversations before a test changed them
  let pinnedBefore: Array<string> | undefined
  // throwaway channels a test made
  const channels = new Set<string>()

  const restoreStatuses = async () => {
    for (const [convID, want] of [...statusesBefore]) {
      if ((await statusOf(convID)) !== want) {
        await restoreConversationStatus(convID, want)
        await expectStatus('a restored conversation status', convID, want)
      }
      statusesBefore.delete(convID)
    }
  }

  // The row menu of the conversation `convID` named `name`, its status noted first for the
  // afterEach (a menu item can hide or mute it). Bound: conv 75 the first time, then row menu.
  const openRowMenu = async (name: string, convID: string) => {
    if (!statusesBefore.has(convID)) statusesBefore.set(convID, await statusOf(convID))
    await openInboxRowMenu(name, convID)
  }

  const restorePins = async () => {
    if (pinnedBefore === undefined) return
    const want = JSON.stringify(pinnedBefore)
    if (JSON.stringify(await pinnedConvs()) !== want) {
      await mainRpc('keybase.1.gregor.updateCategory', {body: want, category: pinnedCategory, dtime: {offset: 0, time: 0}})
      await expectPinned('the restored pinned conversations', p => JSON.stringify(p) === want)
    }
    pinnedBefore = undefined
  }

  const deleteChannels = async () => {
    for (const topicName of [...channels]) {
      await deleteThrowawayChannel(topicName)
      channels.delete(topicName)
    }
  }

  // The inbox search placeholder's field, while the inbox filter is open.
  const inboxSearchField = () =>
    browser.$('-ios predicate string:type == "XCUIElementTypeTextField" AND placeholderValue == "Search" AND visible == 1')

  // No thread search or inbox filter left open. The filter ends with the X on its row (its search
  // filter's clear, which cancels the inbox search): the one level with the field.
  const closeSearches = async () => {
    if (await searchOpen()) await closeSearch()
    await escapeToTabs()
    await navigateToChat()
    const field = inboxSearchField()
    if (!(await field.isExisting())) return
    const {y} = await field.getLocation()
    const {height} = await field.getSize()
    const level: Array<WebdriverIO.Element> = []
    for (const x of await browser.$$(`~${T.SEARCH_FILTER_CLEAR}`).getElements()) {
      const at = await x.getLocation().catch(() => undefined)
      const size = await x.getSize().catch(() => undefined)
      if (at && size && at.y + size.height / 2 >= y && at.y + size.height / 2 <= y + height) level.push(x)
    }
    if (level.length !== 1) throw new Error(`${level.length} clear buttons on the inbox filter's row, not one`)
    await level[0]!.click()
    await field.waitForExist({reverse: true, timeout: 5_000})
  }

  // Nothing a test changed left behind, after a timeout too. The host's restores go first, then the
  // phone's screens. Worst case (s): close 5, keyboard 5, the statuses 490 (two conversations, each a
  // read 75, the set 75 and its poll 95), the pins 245 (the same), a channel 120, the searches 52
  // (close 5, escapeToTabs 30, the tab 5, the field 1, the clear found 5 and tapped 1, the field gone
  // 5) = 917.
  afterEach(async function () {
    this.timeout(960_000)
    await withCleanup(closeMessageMenu, [hideKeyboard, restoreStatuses, restorePins, deleteChannels, closeSearches])
  })

  it('the DM hidden from its inbox row leaves the inbox, and a new message brings it back', async function () {
    // worst case (s): conv 75, row menu 295, the seq 2, item 20, calls 10, conv 95, row 90 (the
    // self conversation), absent 90, step 2, peer 70, peer send 90, conv 95, row 90, step 2, open
    // 100, the row 30, step 2 = 1158
    this.timeout(1_200_000)
    const {convID} = data.direct
    const original = await statusOf(convID)
    check(original === conversationStatus.unfiled, 'the DM does not start unfiled (a failed restore left it hidden or muted)')
    statusesBefore.set(convID, original)

    await openRowMenu(data.secondUser, convID)
    const seq = await currentCallSeq()
    await chooseMenuItem('Hide until next message')
    await waitForCall('the hide to go out', seq, 'chat.1.local.SetConversationStatusLocal')
    await expectStatus('the DM hidden', convID, conversationStatus.ignored)
    // the self conversation shows the inbox loaded, so the DM's absence counts
    await scrollInboxTo(data.smokeUser)
    check(!(await inboxHasRow(data.secondUser)), 'the hidden DM is still in the inbox')
    await step('Hidden: the DM is gone from the inbox')

    const text = e2eMarker('conv-unhide')
    await sendWithRetry(await sender(), convID, text)
    await expectStatus('the DM back after a new message', convID, conversationStatus.unfiled)
    await scrollInboxTo(data.secondUser)
    await step('A new message brought the DM back', {card: true})
    // read, so the DM is not left unread
    await openConversation(convID)
    await waitForRow(text, 30_000)
    await step('The new message in the DM')
  })

  it('the DM muted from its info panel stays muted through a relaunch, and unmutes', async function () {
    // worst case (s): conv 75, open 100, panel 25, switch 10, the seq 2, the tap 1, calls 10, conv
    // 95, app 20, step 2, relaunch 200, signed in 90, row 90, app 20, step 2, open 100, panel 25,
    // switch 10, the seq 2, the tap 1, calls 10, conv 95, app 20, step 2 = 1007
    this.timeout(1_060_000)
    const {convID} = data.direct
    const original = await statusOf(convID)
    check(original === conversationStatus.unfiled, 'the DM does not start unfiled (a failed restore left it hidden or muted)')
    statusesBefore.set(convID, original)

    await openConversation(convID)
    await openSettings()
    let seq = await currentCallSeq()
    await el(T.CHAT_INFO_PANEL_MUTE).click()
    await waitForCall('the mute to go out', seq, 'chat.1.local.SetConversationStatusLocal')
    await expectStatus('the DM muted', convID, conversationStatus.muted)
    await expectApp('the DM muted', async () => appConversationMuted(convID), true)
    await step('Muted from the info panel')

    await expectPersists(
      'the DM muted',
      async () => {
        await waitSignedIn()
        // the inbox loads the conversation's metadata with its row
        await scrollInboxTo(data.secondUser)
        await expectApp('the DM loaded', async () => (await appConversationMuted(convID)) !== undefined, true)
        return appConversationMuted(convID)
      },
      true
    )
    creditSurface('relaunch')
    await step('After a relaunch the DM is still muted')

    await openConversation(convID)
    await openSettings()
    seq = await currentCallSeq()
    await el(T.CHAT_INFO_PANEL_MUTE).click()
    await waitForCall('the unmute to go out', seq, 'chat.1.local.SetConversationStatusLocal')
    await expectStatus('the DM unmuted', convID, conversationStatus.unfiled)
    await expectApp('the DM unmuted', async () => appConversationMuted(convID), false)
    await step('Unmuted', {card: true})
  })

  it("Mark all as read from KB_E2E_TEAM's header reads its unread channel", async function () {
    // worst case (s): channel 240, peer 70, peer send 90, conv 105 (polled 30, overrun by one read),
    // badge 30, row 90, step 2, header 90, gear 15, the seq 2, item 20, calls 10, conv 95, app 20,
    // step 2 = 881
    this.timeout(940_000)
    const made = await createThrowawayChannel('read')
    channels.add(made.topicName)
    const {convID, topicName} = made
    await sendWithRetry(await sender(), convID, e2eMarker('conv-unread'))
    const unread = async () => {
      const {readerInfo} = await mainConversation(convID)
      return readerInfo.readMsgid < readerInfo.maxMsgid
    }
    await waitFor('the host to read the channel unread', async () => ((await unread()) ? true : undefined), {
      interval: 1_000,
      timeout: 30_000,
    })
    await waitFor('the app to count the channel unread', async () => ((await unreadCount(convID)) > 0 ? true : undefined), {
      interval: 500,
      timeout: 30_000,
    })
    // the channel's row, among KB_E2E_TEAM's channels: the inbox shows it unread
    await scrollInboxTo(`#${topicName}`)
    await step('The channel unread in the inbox')

    // KB_E2E_TEAM's own header, by its name: never another team's
    const gear = await scrollInboxToTeamHeader(data.team)
    await openMenuFrom("the team header's menu", async () => gear.click())
    const seq = await currentCallSeq()
    await chooseMenuItem('Mark all as read')
    await waitForCall('the mark read to go out', seq, 'chat.1.local.markTLFAsReadLocal')
    await waitFor('the host to read the channel read', async () => ((await unread()) ? undefined : true), {
      interval: 1_000,
      timeout: 20_000,
    })
    await expectApp('the channel read', async () => unreadCount(convID), 0)
    await step('Marked read', {card: true})
  })

  it('the self conversation pinned from its row stays pinned through a relaunch, and unpins', async function () {
    // worst case (s): self 60, gregor 75, conv 75, row menu 295, the seq 2, item 20, calls 10, gregor
    // 95, app 20, step 2, relaunch 200, signed in 90, row 90, app 20, step 2, row menu 295, the seq 2,
    // item 20, calls 10, gregor 95, app 20, step 2 = 1500
    this.timeout(1_560_000)
    const selfConvID = await directConvIDFromCli(data.smokeUser)
    const original = await pinnedConvs()
    check(!original.includes(selfConvID), 'the self conversation starts pinned (a failed restore left it pinned)')
    pinnedBefore = original

    await openRowMenu(data.smokeUser, selfConvID)
    let seq = await currentCallSeq()
    await chooseMenuItem('Pin to top')
    await waitForCall('the pin to go out', seq, 'keybase.1.gregor.updateCategory')
    await expectPinned('the self conversation pinned', p => p.includes(selfConvID))
    await expectApp('the self conversation pinned', async () => appConversationPinned(selfConvID), true)
    await step('Pinned to the top')

    await expectPersists(
      'the self conversation pinned',
      async () => {
        await waitSignedIn()
        await scrollInboxTo(data.smokeUser)
        await expectApp('the self conversation in the layout', async () => (await appConversationPinned(selfConvID)) !== undefined, true)
        return appConversationPinned(selfConvID)
      },
      true
    )
    creditSurface('relaunch')
    await step('After a relaunch the self conversation is still pinned')

    await openRowMenu(data.smokeUser, selfConvID)
    seq = await currentCallSeq()
    await chooseMenuItem('Unpin')
    await waitForCall('the unpin to go out', seq, 'keybase.1.gregor.updateCategory')
    await expectPinned('the self conversation unpinned', p => !p.includes(selfConvID))
    await expectApp('the self conversation unpinned', async () => appConversationPinned(selfConvID), false)
    await step('Unpinned', {card: true})
  })

  // The inbox filter lists name hits under "Chats", then other sections (open teams, bots, and
  // messages whose text matches): only a name hit counts here.
  it('the inbox filter finds a channel by its name and opens it', async function () {
    // worst case (s): top 90, the placeholder 5, the tap 1, the field 10, type 15, hits 20, step 2,
    // the tap 1, the conversation 20, step 2 = 166
    this.timeout(200_000)
    const want = `#${E2E_CHANNELS.short}`
    const other = `#${E2E_CHANNELS.long}`
    await scrollInboxToTop()
    await el(T.CHAT_INBOX_SEARCH).waitForExist({timeout: 5_000})
    await el(T.CHAT_INBOX_SEARCH).click()
    await inboxSearchField().waitForExist({timeout: 10_000})
    await inboxSearchField().addValue(E2E_CHANNELS.short)

    // a channel hit reads "<team>" and " #<channel>" (a no-break space first)
    const labelled = async (labels: ReadonlyArray<string>) => {
      const out: Array<{e: WebdriverIO.Element; label: string; rect: Rect}> = []
      for (const e of await browser.$$('-ios predicate string:type == "XCUIElementTypeStaticText" AND visible == 1').getElements()) {
        const label = ((await e.getAttribute('label').catch(() => null)) ?? '').replace(/\u00a0/g, ' ').trim()
        if (!labels.includes(label)) continue
        const at = await e.getLocation().catch(() => undefined)
        const size = await e.getSize().catch(() => undefined)
        if (at && size) out.push({e, label, rect: {...at, ...size}})
      }
      return out
    }
    const laterSections = ['Open teams', 'Suggested teams', 'Featured bots', 'Suggested bots', 'Messages']
    const hit = await waitFor(
      'the channel among the name hits',
      async () => {
        const found = await labelled(['Chats', ...laterSections, want, other])
        const chats = found.filter(f => f.label === 'Chats')
        if (chats.length !== 1) return undefined
        const names = found.filter(f => f.label === want)
        const inNames = inNameSection(
          names.map(n => n.rect),
          chats[0]!.rect,
          found.filter(f => laterSections.includes(f.label)).map(f => f.rect)
        )
        if (found.some(f => f.label === other)) throw new Error('the filter lists a channel its query does not match')
        if (inNames.length > 1) throw new Error(`${inNames.length} name hits for the channel, not one`)
        return inNames.length === 1 ? names[inNames[0]!]!.e : undefined
      },
      {interval: 500, timeout: 20_000}
    )
    await step('The filter lists the channel by name')
    await hit.click()
    await waitFor(
      'the channel to open',
      async () => ((await visibleConversation()) === data.convIDs[E2E_CHANNELS.short] ? true : undefined),
      {interval: 250, timeout: 20_000}
    )
    await step('The channel opened from the filter', {card: true})
  })

  it('thread search finds a stamped word sent just before', async function () {
    // worst case (s): open 100, sent 25, id 10, keyboard 5, search 15, searchFor 80, the row 5, step
    // 2 = 242
    this.timeout(270_000)
    await openConversation(data.convIDs[E2E_CHANNELS.scratch])
    // unique to this post: the search splits the stamp at its dashes and matches every part
    const text = e2eMarker('zebraword')
    const ordinal = await sendMessage(text)
    await waitFor('the message id', async () => ((await storedMessageState(ordinal))?.id ? true : undefined), {
      interval: 250,
      timeout: 10_000,
    })
    await hideKeyboard()
    await openThreadSearch()
    // the service indexes a message just after it lands: searchFor runs a search that found nothing again
    const counter = await searchFor(text, 45_000)
    check(counter === '1 of 1', `the thread search found ${counter}, not one hit`)
    await rowElement(text).waitForExist({timeout: 5_000})
    await step('One hit, and the thread shows it', {card: true})
  })
})
