// A subteam's avatar and custom emoji from the phone, each picked in the photo picker, in tests that
// each own a subteam of the e2e team: the team page header's avatar opens the avatar editor and its
// photo picker, the corpus png picked there is saved, and the server then answers an avatar for the
// subteam; and an emoji is added from the Emoji tab's Add emoji (Choose Images, the corpus png, a
// stamped alias), listed by the host, then deleted from its row's menu. Each pick is proven by the
// file the editor or the emoji's row shows: the photo picker hands the app a re-encoded copy, so it
// is matched to the png by the format its bytes say and its pixel size.
//
// The e2e team itself is never changed: the screen up is checked to aim at the test's subteam before
// each writing tap. The emoji tab is opened once it lists an emoji the host seeded, so it knows the
// subteam's conversation (a desktop finding: an Add emoji opened before it does never adds), and the
// seeded emoji is the anchor that the deleted one's absence is read against. The flow's afterEach
// closes a picker a test left up and deletes the subteam.
import {stampedEmojiName} from '../../accounts/run-id'
import {CORPUS_DIR} from '../../fixtures/corpus/corpus'
import {withCleanup} from '../../shared/cleanup.ts'
import {e2eRunId} from '../../shared/run-marker'
import * as T from '../../shared/test-ids'
import {deleteSubteamIfPresent, mainRead, requireThisRunSubteam, runChatApi, subteamAvatarUrl} from '../../shared/teams.ts'
import {creditSurface} from '../gate/attempt'
import {elementInRow} from '../gate/chat-lib.ts'
import {ensurePhotoCorpus} from '../gate/device'
import {sourceElements} from '../gate/page-source-lib.ts'
import {currentCallSeq, uiCallCount, waitForUiCall} from '../gate/recorder'
import {step} from '../gate/step'
import {closeSystemPickers, pickOnePhoto} from '../gate/system-ui'
import {hideKeyboard} from '../helpers/chat'
import {el} from '../helpers/elements'
import {buttonLabelled, clickUntil, filesRowNamed, fillField, pressTestID, tapButton} from '../helpers/files'
import {expectScreen} from '../gate/screens'
import {waitFor} from '../helpers/lifecycle'
import {chooseMenuItem, openMenuFrom} from '../helpers/menus'
import {escapeToTabs} from '../helpers/navigate'
import {requirePickedPng} from '../helpers/profile'
import {expectHost, expectTeamPage, makeOwnSubteamWithID, masked, onlyField, openSubteamUntil, requireOnSubteam, revealTeamHeader} from '../helpers/teams'

type Params = Record<string, unknown>

const UPLOAD_TEAM_AVATAR = 'keybase.1.teams.uploadTeamAvatar'
const ADD_EMOJIS = 'chat.1.local.addEmojis'
const REMOVE_EMOJI = 'chat.1.local.removeEmoji'

const MEMBERS = {body: T.TEAMS_MEMBER_LIST, button: T.TEAMS_TAB_MEMBERS_BUTTON}
const EMOJI = {body: T.TEAMS_EMOJI_TAB, button: T.TEAMS_TAB_EMOJI_BUTTON}

describe('teams avatar and emoji', function () {
  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   corpus    ensurePhotoCorpus: one addmedia each when missing, 7 x 120 = 840 (0 once recorded)
  //   subteam   makeOwnSubteamWithID 915 (the make 600, its id 315)
  //   host      subteamAvatarUrl 135 (four reads of 30, 5s apart);  polled  60s of reads, overrun by
  //             one 195;  seed  the CLI 255;  emoji  30s of main service reads, overrun by one 345
  //   opened    openSubteamUntil: 60s of tries, overrun by one (team 109, tab 24, `ready`)
  //   header    revealTeamHeader 8;  page  expectTeamPage 21;  pin  requireOnSubteam 1
  //   press     pressTestID 12;  button  tapButton 6;  screen  a screen waited for 11 (10, read 1)
  //   pick      pickOnePhoto 58;  png  requirePickedPng 162
  //   field     onlyField 11;  fill  fillField 26;  submit  clickUntil 10
  //   row       a row by its name 31 (30, one drag 1);  in row  elementInRow 2;  gone  10s of reads
  //             (each the anchor's buttonLabelled 24 and one page source 1), overrun by one 35
  //   menu      openMenuFrom 19;  item  chooseMenuItem 22
  //   calls     one read 2;  waited for  12 (10, one read 2)
  //   step      2 (its 1s settle and the attach)
  //   cleanup   closeSystemPickers 45, the keyboard 5, the test's subteam 750 (an existence read 315,
  //             the delete 90, 30s of reads overrun by one 315), escapeToTabs 30 = 830

  // every subteam a test made, added before its make
  const madeNames = new Set<string>()

  const deleteMade = async () => {
    for (const name of [...madeNames]) {
      await masked(async () => deleteSubteamIfPresent(name))
      madeNames.delete(name)
    }
  }

  // Worst case (s): 830.
  afterEach(async function () {
    this.timeout(850_000)
    await withCleanup(closeSystemPickers, [hideKeyboard, deleteMade, escapeToTabs])
  })

  it("a subteam's avatar set from a corpus png picked in the photo picker", async function () {
    // worst case (s): corpus 840, subteam 915, host 135, opened 203 (60 of tries, overrun by one: team
    // 109, tab 24, the header avatar 10), pin 1, header 8, press 12, screen 11, pick 58, png 162, step
    // 2, pin 1, calls 2, button 6, waited for 12, polled 195, page 21, step 2 = 2586
    this.timeout(2_620_000)
    await ensurePhotoCorpus()
    const {name, teamID} = await makeOwnSubteamWithID('av', madeNames)
    // a new subteam answers its parent's avatar until it has its own
    const before = await masked(async () => subteamAvatarUrl(name))
    const onSubteam = (p: Params) => p['teamID'] === teamID
    await openSubteamUntil("the subteam's page", name, teamID, MEMBERS, async () => el(T.TEAMS_HEADER_AVATAR).waitForExist({timeout: 10_000}))

    await requireOnSubteam("the subteam's page", 'team', onSubteam)
    await revealTeamHeader()
    await pressTestID(T.TEAMS_HEADER_AVATAR, "the header's avatar")
    await expectScreen("the subteam's avatar editor", 'profileEditAvatar', p => onSubteam(p) && p['sendChatNotification'] === true)
    // the editor opens the photo picker on its own once it has presented: nothing is tapped for it
    await pickOnePhoto('e2e-c.png')
    await requirePickedPng("the subteam's avatar editor to show the picked photo")
    creditSurface('photo-picker')
    await step("The picked png in the subteam's avatar editor")

    await requireOnSubteam("the subteam's avatar editor", 'profileEditAvatar', onSubteam)
    const seq = await currentCallSeq()
    await tapButton('Save', "the avatar editor's Save")
    await waitForUiCall('the team avatar upload', seq, UPLOAD_TEAM_AVATAR, {timeout: 10_000})
    await masked(async () =>
      waitFor(
        'the server to answer a new avatar for the subteam',
        async () => {
          const now = await subteamAvatarUrl(name)
          return now !== '' && now !== before ? true : undefined
        },
        {interval: 3_000, timeout: 60_000}
      )
    )
    await expectTeamPage('the subteam page after Save', teamID)
    await step("The subteam's avatar saved", {card: true})
  })

  it("a subteam's emoji added from a corpus png picked in the photo picker, then deleted", async function () {
    // worst case (s):
    // setup: corpus 840, subteam 915, seed 255, emoji 345, opened 224 (60 of tries, overrun by one:
    //   team 109, tab 24, the row 31) = 2579;
    // add: pin 1, button 6, screen 11, press 12, pick 58, png 162, field 11, fill 26, step 2, pin 1,
    //   calls 2, submit 10, emoji 345, page 21, row 31, step 2 = 701;
    // delete: row 31, in row 2, menu 19, pin 1, calls 2, item 22, waited for 12, emoji 345, gone 35,
    //   step 2 = 471
    // = 2579 + 701 + 471 = 3751
    this.timeout(3_780_000)
    const runId = e2eRunId()
    await ensurePhotoCorpus()
    const {generalConvID, name, teamID} = await makeOwnSubteamWithID('emo', madeNames)
    const seed = stampedEmojiName('s', runId)
    const alias = stampedEmojiName('a', runId)
    type UserEmojiRes = {emojis?: {emojis?: Array<{name: string; emojis?: Array<{alias: string}> | null}> | null}}
    // the aliases of the subteam's emoji, as the main service lists them for the smoke account
    const teamEmojis = async () => {
      const res = await mainRead<UserEmojiRes>('chat.1.local.userEmojis', {
        convID: null,
        opts: {getAliases: true, getCreationInfo: false, onlyInTeam: false},
      })
      return (res.emojis?.emojis ?? [])
        .filter(g => g.name === name)
        .flatMap(g => (g.emojis ?? []).map(e => e.alias))
        .sort()
    }
    const same = (want: Array<string>) => (got: Array<string>) => got.length === want.length && got.every((a, i) => a === [...want].sort()[i])
    requireThisRunSubteam(name)
    await masked(async () =>
      runChatApi('emojiadd', {alias: seed, channel: {members_type: 'team', name, topic_name: 'general'}, filename: `${CORPUS_DIR}/e2e-c.png`})
    )
    await expectHost('the seeded emoji', teamEmojis, same([seed]))
    const emojiRow = async (a: string, timeout = 30_000) => filesRowNamed(`:${a}:`, 'an emoji row', {testID: T.TEAMS_EMOJI_ROW, timeout})
    // the tab lists a team's emoji once it has loaded them afresh
    await openSubteamUntil("the subteam's emoji", name, teamID, EMOJI, async () => emojiRow(seed, 10_000))
    const onSubteam = (p: Params) => p['teamID'] === teamID

    // -- the emoji added from Add emoji --------------------------------------------------------------
    await requireOnSubteam("the subteam's emoji", 'team', onSubteam)
    await tapButton('Add emoji', "the tab's Add emoji")
    const onGeneral = (p: Params) => p['conversationIDKey'] === generalConvID && onSubteam(p)
    await expectScreen("the subteam's Add emoji", 'teamAddEmoji', onGeneral)
    await pressTestID(T.TEAMS_ADD_EMOJI_CHOOSE_IMAGES, "Add emoji's Choose Images")
    await pickOnePhoto('e2e-c.png')
    await requirePickedPng("the emoji's row to show the picked photo")
    creditSurface('photo-picker')
    await fillField(await onlyField('TextField', "the emoji's alias field"), alias, "the emoji's alias field")
    await step('The picked png given its alias')
    await requireOnSubteam('Add emoji', 'teamAddEmoji', onGeneral)
    let seq = await currentCallSeq()
    // the keyboard is up: a first tap may only close it
    await clickUntil(
      async () => el(T.TEAMS_ADD_EMOJI_SUBMIT).getElement(),
      async () => (await uiCallCount(seq, ADD_EMOJIS)) > 0,
      "Add emoji's Add emoji"
    )
    await expectHost('the added emoji', teamEmojis, same([seed, alias]))
    await expectTeamPage('the subteam page after Add emoji', teamID)
    await emojiRow(alias)
    await step('The emoji added', {card: true})

    // -- the emoji deleted from its row's menu --------------------------------------------------------
    const row = await emojiRow(alias)
    const menu = await elementInRow(row.rect, T.TEAMS_EMOJI_ROW_MENU)
    await openMenuFrom("the emoji's menu", async () => menu.click())
    await requireOnSubteam("the subteam's emoji", 'team', onSubteam)
    seq = await currentCallSeq()
    await chooseMenuItem('Delete emoji')
    await waitForUiCall('the delete to go out', seq, REMOVE_EMOJI)
    await expectHost('the emoji after Delete emoji', teamEmojis, same([seed]))
    // the host still lists the seeded emoji: its row is the anchor that the deleted one's absence is
    // read against, with the tab's Add emoji still drawn
    await waitFor(
      "the deleted emoji's row to go, with the seeded one's still drawn",
      async () => {
        const anchor = await buttonLabelled('Add emoji', "the tab's Add emoji").then(
          () => true,
          () => false
        )
        const rows = sourceElements(await browser.getPageSource())
          .filter(e => e.attrs['name'] === T.TEAMS_EMOJI_ROW && e.attrs['visible'] === 'true')
          .map(e => (e.attrs['label'] ?? '').split(', ').map(p => p.trim()))
        const seedDrawn = rows.some(parts => parts.includes(`:${seed}:`))
        const aliasDrawn = rows.some(parts => parts.includes(`:${alias}:`))
        return anchor && seedDrawn && !aliasDrawn ? true : undefined
      },
      {interval: 500, timeout: 10_000}
    )
    await step('The emoji deleted')
  })
})
