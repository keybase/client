// What the phone sends to make, change and delete git repos, in two tests that each own their repo:
// a personal repo made from "New personal repository", its clone URL copied (the pasteboard compared
// with the host's URL, never logged, then overwritten) and deleted by typing its name; and a team
// repo in a throwaway subteam of the e2e team, made with "Notify the team" off, announced in a channel
// the host made, its announcements turned off, and deleted with "Notify the team" off.
//
// The e2e team itself never gets a repo: the team dropdown is read to show the subteam alone before
// Create, and each later writing tap is behind a check that the screen aims at it. Archive is never
// pressed. The host stays on the smoke account: it makes the subteam and its channel and reads back
// what the phone did, and the flow's afterEach deletes each repo of this run's stamps (the team repo
// first, with its chat notifications off, then reads that it is gone) and only then the subteam (a
// deleted team's name is never free again, so each attempt takes a fresh one).
import {loadE2EAccounts} from '../../accounts/env'
import {stampedChannelName} from '../../accounts/run-id'
import {withCleanup} from '../../shared/cleanup.ts'
import {deleteRepoIfPresent, personalRepo, repoGone, repoListed, repoUrl, teamRepo, teamRepoChat, type RepoRef} from '../../shared/git.ts'
import {e2eRunId} from '../../shared/run-marker'
import * as T from '../../shared/test-ids'
import {makeSubteamChannel} from '../../shared/teams.ts'
import {requireAppIsSmoke} from '../gate/accounts'
import {creditSurface} from '../gate/attempt'
import {pasteboardText, setPasteboard} from '../gate/device'
import {settingShown} from '../gate/persisted-lib.ts'
import {currentCallSeq, waitForUiCall} from '../gate/recorder'
import {retriedNavigation, step} from '../gate/step'
import {closeMessageMenu, hideKeyboard} from '../helpers/chat'
import {el, waitForTestID} from '../helpers/elements'
import {drag, fillField, pressTestID, tapButton} from '../helpers/files'
import {expectScreen} from '../gate/screens'
import {waitFor} from '../helpers/lifecycle'
import {check, chooseMenuItem, dragSheetUp, NAMED_ELEMENT_TYPES, onScreen, openMenuFrom, press} from '../helpers/menus'
import {escapeToTabs, navigateToMore, tapSettingsRow} from '../helpers/navigate'
import {labelHas, labelParts, sourceElements} from '../gate/page-source-lib.ts'
import {
  drainMade,
  expectHost,
  makeOwnSubteamWithID,
  masked,
  onlyField,
  openTeamFromList,
  requireOnSubteam,
  textPartShown,
  TEXTS,
} from '../helpers/teams'

type Params = Record<string, unknown>

describe('git', function () {
  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   gone      repoGone reads the list, which must parse (a failed or reshaped list never reads as
  //             gone); it may be empty, so no other entry is required
  //   host      a retried host read (readBack) of the CLI 255 (four of 60);  polled  30s of reads,
  //             overrun by one read: of the CLI 285
  //   subteam   makeOwnSubteamWithID 915 (600 and the id read 315);  seed  makeSubteamChannel 510
  //   app       requireAppIsSmoke 15;  git  openGit 119 (escapeToTabs 30, the More tab 15, the row 54,
  //             the screen 11, the list 5, slack 4)
  //   team      openTeamFromList: 60s of tries, overrun by one 109 = 169
  //   screen    a screen waited for 11 (10, read 1);  pin  requireOnSubteam 1
  //   button    tapButton 6;  text  textShown 6 (16 with a 15s wait);  field  onlyField 11;  fill
  //             fillField 26 (the field 10, the typing 15, the read 1)
  //   menu      openNewRepo 52 (openMenuFrom 19: 15, overrun by one try: the tap 1, the sheet 3;
  //             chooseMenuItem 22: 15, overrun by one drag 1, the tap 1, the sheet gone 5; screen 11)
  //   row       repoText 31 (30, one drag 1);  pick  the dropdown's team 31 (30, one drag 1, its settle
  //             inside the 30)
  //   pasteboard  setPasteboard 50;  pasteboardText 30, polled 10s overrun by one read 40
  //   calls     one read 2;  waited for  12 (10, one read 2)
  //   step      2 (its 1s settle and the attach)

  // -- what the afterEach puts back ---------------------------------------------------------------

  // every subteam a test made, added before its make
  const madeNames = new Set<string>()
  // every repo a test may have made, added before the tap that creates it
  const madeRepos = new Set<RepoRef>()
  // set before the copy button is tapped, cleared once filler replaced the clone URL
  let urlOnPasteboard = false

  const filler = () => `e2e-${e2eRunId()}-pasteboard`

  // Bound: 50.
  const overwritePasteboard = async () => {
    if (!urlOnPasteboard) return
    await setPasteboard(filler())
    urlOnPasteboard = false
  }

  // Deletes every repo of the test, then every subteam: a failed repo delete leaves the subteam for
  // the sweeper, which lists a stale subteam's repos before it deletes the subteam. Bound: 1020 a team
  // repo (listed 255, chat off 255, delete 255, listed again 255), 765 a personal one, 750 a name
  // (deleteSubteamIfPresent: an existence read 315, the delete 90, 30s of reads overrun by one 315).
  const restoreMade = async () => {
    for (const r of [...madeRepos]) {
      await masked(async () => deleteRepoIfPresent(r))
      madeRepos.delete(r)
    }
    await drainMade(madeNames)
  }

  // Worst case (s): the pasteboard 50, a team repo 1020, the one name of a test 750, close 19,
  // keyboard 5, escape 30 = 1874.
  afterEach(async function () {
    this.timeout(1_900_000)
    await withCleanup(closeMessageMenu, [hideKeyboard, overwritePasteboard, restoreMade, escapeToTabs])
  })

  // -- reads --------------------------------------------------------------------------------------

  // The git list, from the More tab. Bound: 90.
  const openGit = async () => {
    await escapeToTabs()
    await navigateToMore()
    await tapSettingsRow('Git')
    // on the phone the git list is the More tab's settingsTabs.gitTab (gitRoot is the desktop tab's)
    await expectScreen('the git list', 'settingsTabs.gitTab')
    await waitForTestID(T.GIT_REPO_LIST, 5_000)
  }

  // The one text drawn reading exactly `label`, the list dragged until it shows. The label goes only
  // into the in-memory compare, never a selector or an error. Bound: 30s, one drag 1.
  const repoText = async (label: string) => {
    let towardEnd = true
    let before: string | undefined
    return waitFor(
      'the repo row',
      async () => {
        // one page source a read: an attribute call per labelled element took most of the bound
        const found = await textPartShown(label, 'the repo row', 0, {forTap: true}).catch(() => undefined)
        if (found && (await onScreen(found))) return found
        const {height} = await browser.getWindowRect()
        // a row the tree holds off screen says which way (only a direction: it is never tapped or
        // taken as shown); else a drag that changed nothing reached the list's end (or the list fits):
        // turn around
        const off = sourceElements(await browser.getPageSource()).find(
          e => NAMED_ELEMENT_TYPES.includes(e.type) && labelHas(e.attrs['label'] ?? '', label)
        )
        if (off) {
          const y = Number(off.attrs['y'])
          await (y > height / 2 ? drag(height * 0.75, height * 0.25) : drag(height * 0.25, height * 0.75))
          return undefined
        }
        const shown = (await browser.$$(TEXTS).getElements()).length
        const signature = String(shown)
        if (signature === before) towardEnd = !towardEnd
        before = signature
        // long drags: the list holds every team's repos
        await (towardEnd ? drag(height * 0.75, height * 0.25) : drag(height * 0.25, height * 0.75))
        return undefined
      },
      {interval: 300, timeout: 30_000}
    )
  }

  // Opens "New encrypted git repository..." and picks `item`. Bound: 52.
  const openNewRepo = async (item: string, isTeam: boolean) => {
    await openMenuFrom('the new repository menu', async () => pressTestID(T.GIT_NEW_REPO, 'the new repository button'))
    await chooseMenuItem(item)
    await expectScreen('the new repository screen', 'gitNewRepo', p => p['isTeam'] === isTeam)
  }

  // Taps the "Notify the team" checkbox drawn `on` and waits for it to draw `off`. Bound: 10s, tap 1,
  // 5s = 16.
  const notifyOff = async (base: string) => {
    await el(T.settingTestID(base, true)).waitForExist({timeout: 10_000})
    await el(T.settingTestID(base, true)).click()
    await el(T.settingTestID(base, false)).waitForExist({timeout: 5_000})
  }

  // The number of repo rows drawn open (their announce checkbox is drawn only for a team repo).
  // Bound: 1.
  const announceCount = async () => (await browser.$$(`~${T.GIT_REPO_ANNOUNCE}`).getElements()).length

  it('a personal repo made, its clone URL copied, and deleted', async function () {
    // worst case (s): app 15, host 255, git 119, new repo 52, field 11, fill 26, step 2, calls 2,
    // button 6, waited for 12, screen 11, polled 285, row 31, its tap 1, filler 50, the button 10 and
    // its tap 1, pasteboard 40, filler 50, step 2, button 6, screen 11, field 11, fill 26, step 2,
    // pin 1, calls 2, button 6, waited for 12, screen 11, polled 285, step 2 = 1356
    this.timeout(1_400_000)
    await requireAppIsSmoke()
    const repo = personalRepo()
    check(!(await masked(async () => repoListed(repo))), 'this run already has its personal repo')
    await openGit()

    await openNewRepo('New personal repository', false)
    await fillField(await onlyField('TextField', 'the repo name field'), repo.name, 'the repo name field')
    await step('The personal repo named')
    madeRepos.add(repo)
    let seq = await currentCallSeq()
    await tapButton('Create', "the new repo's Create")
    await waitForUiCall('the repo create to go out', seq, 'keybase.1.git.createPersonalRepo')
    await expectScreen('the git list after Create', 'settingsTabs.gitTab')
    await expectHost('the personal repo listed', async () => repoListed(repo), listed => listed)

    await press(await repoText(repo.name), 'the repo row')
    // the clone URL is copied over filler, so a stale pasteboard cannot pass; it is compared here
    // and never logged
    await setPasteboard(filler())
    urlOnPasteboard = true
    await el(T.GIT_REPO_COPY_URL).waitForExist({timeout: 10_000})
    await pressTestID(T.GIT_REPO_COPY_URL, "the repo's copy URL")
    await waitFor("the pasteboard to hold the repo's clone URL", async () => ((await pasteboardText()) === repoUrl(repo) ? true : undefined), {
      interval: 500,
      timeout: 10_000,
    })
    creditSurface('pasteboard')
    await overwritePasteboard()
    // the git list holds the smoke account's other repos, of teams that are not test ones
    await step('The clone URL copied', {screenshot: false})

    await tapButton('Delete', "the repo's Delete")
    const onRepo = (p: Params) => p['name'] === repo.name && !p['teamname']
    await expectScreen('the delete screen of the personal repo', 'gitDeleteRepo', onRepo)
    await fillField(await onlyField('TextField', 'the delete confirm field'), repo.name, 'the delete confirm field')
    await step('The delete confirmed by name', {card: true})
    await requireOnSubteam('the personal repo delete', 'gitDeleteRepo', onRepo)
    seq = await currentCallSeq()
    await tapButton('Delete', "the delete screen's Delete")
    await waitForUiCall('the repo delete to go out', seq, 'keybase.1.git.deletePersonalRepo')
    await expectScreen('the git list after Delete', 'settingsTabs.gitTab')
    await expectHost('the personal repo gone', async () => repoGone(repo), gone => gone)
    // the git list holds the smoke account's other repos, of teams that are not test ones
    await step('The personal repo deleted', {screenshot: false})
  })

  it('a team repo made in a subteam, announced in a channel, its announcements turned off, and deleted', async function () {
    // worst case (s): app 15, subteam 600 and its id 315, seed 510, host 255, team 169, git 119, new repo 52, the
    // dropdown 12 (its wait 10, the press 2), pick 31 and its tap 2, picked 6, field 11, fill 26, notify 16,
    // step 2, calls 2, button 6, waited for 12, screen 11, polled 285, chat 255, row 31, its tap 1,
    // announce 11, link 16 and its tap 1, screen 11, channel 6 and its tap 1, step 2, pin 1, calls 2,
    // button 6, waited for 12, polled 285, screen 11, link 16, step 2, count 1, calls 2, its tap 1,
    // waited for 12, polled 285, step 2, button 6, screen 11, notify 16, field 11, fill 26, step 2,
    // pin 1, calls 2, button 6, waited for 12, screen 11, polled 285, step 2 = 3821
    this.timeout(4_000_000)
    await requireAppIsSmoke()
    const {name, teamID} = await makeOwnSubteamWithID('git', madeNames)
    const channel = stampedChannelName('gitch', e2eRunId())
    await masked(async () => makeSubteamChannel(name, channel))
    const repo = teamRepo(name)
    check(!(await masked(async () => repoListed(repo))), 'this run already has its team repo in the new subteam')
    // the picker and the channel list find the subteam in the app's teams list, which hears of a
    // subteam the host made once it loads again: the Teams tab lists the subteam first
    await retriedNavigation("the subteam's page", async () => openTeamFromList(name, teamID), {intervals: [2_000], timeout: 60_000})
    await openGit()

    // -- made, with the dropdown showing the subteam alone ------------------------------------------
    await openNewRepo('New team repository', true)
    await pressTestID(T.GIT_NEW_TEAM_DROPDOWN, 'the team dropdown')
    // the subteam's row in the dropdown's sheet, the sheet dragged up until it shows; a row found right
    // after a drag is read again once the sheet settles, as a sheet still gliding takes a tap as the
    // stop of its glide (the row above the subteam's is the e2e team's, the teams sorted by name)
    let dragged = false
    const item = await waitFor(
      'the subteam in the team dropdown',
      async () => {
        const found = await textPartShown(name, 'the subteam in the team dropdown', 0, {forTap: true}).catch(() => undefined)
        if (found && (await onScreen(found))) {
          if (!dragged) return found
          dragged = false
          await browser.pause(800)
          return undefined
        }
        dragged = true
        await dragSheetUp()
        return undefined
      },
      {interval: 300, timeout: 30_000}
    )
    await press(item, 'the subteam in the team dropdown')
    // the dropdown itself shows the one team picked: the subteam, never the e2e team, and no prompt
    const team = loadE2EAccounts().team
    await waitFor(
      'the dropdown to show the subteam alone',
      async () => {
        const label = (await el(T.GIT_NEW_TEAM_DROPDOWN).getAttribute('label').catch(() => null)) ?? ''
        const parts = labelParts(label)
        return parts.includes(name) && !parts.includes(team) && !parts.includes('Pick a team') ? true : undefined
      },
      {interval: 250, timeout: 5_000}
    )
    await fillField(await onlyField('TextField', 'the repo name field'), repo.name, 'the repo name field')
    await notifyOff(T.GIT_NEW_NOTIFY)
    await step('The team repo named, the team not notified')
    check((await settingShown(T.GIT_NEW_NOTIFY)) === 'off', 'the team would be notified of the new repo: not tapping')
    madeRepos.add(repo)
    let seq = await currentCallSeq()
    await tapButton('Create', "the new repo's Create")
    await waitForUiCall('the repo create to go out', seq, 'keybase.1.git.createTeamRepo')
    await expectScreen('the git list after Create', 'settingsTabs.gitTab')
    await expectHost('the team repo listed', async () => repoListed(repo), listed => listed)
    check(!(await masked(async () => teamRepoChat(repo))).chatDisabled, 'a new team repo has its chat notifications off')

    // -- announced in the subteam's channel ---------------------------------------------------------
    await press(await repoText(`${name}/${repo.name}`), 'the repo row')
    // only this repo's row is open: the one announce checkbox drawn is its
    await el(T.GIT_REPO_ANNOUNCE).waitForExist({timeout: 10_000})
    check((await announceCount()) === 1, 'more than the one repo row is open: not tapping')
    await press(await textPartShown('#general', 'the announce channel link', 15_000, {forTap: true}), 'the announce channel link')
    const onSubteam = (p: Params) => p['teamname'] === name
    await expectScreen("the repo's channel picker", 'gitSelectChannel', onSubteam)
    await press(await textPartShown(channel, 'the channel in the picker', 5_000, {forTap: true}), 'the channel in the picker')
    await step('The channel picked')
    await requireOnSubteam("the repo's channel picker", 'gitSelectChannel', onSubteam)
    seq = await currentCallSeq()
    await tapButton('Submit', "the picker's Submit")
    await waitForUiCall('the channel to go out', seq, 'keybase.1.git.setTeamRepoSettings')
    await expectHost('the repo announced in the channel', async () => teamRepoChat(repo), c => c.channel === channel && !c.chatDisabled)
    await expectScreen('the git list after Submit', 'settingsTabs.gitTab')
    await textPartShown(`#${channel}`, "the repo's announce channel", 15_000)
    // the git list holds the smoke account's other repos, of teams that are not test ones
    await step('The channel set', {screenshot: false})

    // -- announcements turned off -------------------------------------------------------------------
    check((await announceCount()) === 1, 'more than the one repo row is open: not tapping')
    seq = await currentCallSeq()
    await pressTestID(T.GIT_REPO_ANNOUNCE, "the repo's announce check")
    await waitForUiCall('the setting to go out', seq, 'keybase.1.git.setTeamRepoSettings')
    await expectHost('the announcements off', async () => teamRepoChat(repo), c => c.chatDisabled)
    // the git list holds the smoke account's other repos, of teams that are not test ones
    await step('The announcements turned off', {screenshot: false})

    // -- deleted, the team not notified -------------------------------------------------------------
    await tapButton('Delete', "the repo's Delete")
    const onRepo = (p: Params) => p['name'] === repo.name && p['teamname'] === name
    await expectScreen('the delete screen of the team repo', 'gitDeleteRepo', onRepo)
    await notifyOff(T.GIT_DELETE_NOTIFY)
    await fillField(await onlyField('TextField', 'the delete confirm field'), repo.name, 'the delete confirm field')
    await step('The delete confirmed, the team not notified', {card: true})
    await requireOnSubteam('the team repo delete', 'gitDeleteRepo', onRepo)
    check((await settingShown(T.GIT_DELETE_NOTIFY)) === 'off', 'the team would be notified of the delete: not tapping')
    seq = await currentCallSeq()
    await tapButton('Delete', "the delete screen's Delete")
    await waitForUiCall('the repo delete to go out', seq, 'keybase.1.git.deleteTeamRepo')
    await expectScreen('the git list after Delete', 'settingsTabs.gitTab')
    await expectHost('the team repo gone', async () => repoGone(repo), gone => gone)
    // the git list holds the smoke account's other repos, of teams that are not test ones
    await step('The team repo deleted', {screenshot: false})
  })
})
