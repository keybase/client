// Link previews in the smoke account's conversation with itself: a link the phone posts prompts,
// unfurls or stays bare as the account's link preview mode and allow / block lists say, and the
// prompt's Yes / No with and without "Remember" answer the service (resolveUnfurlPrompt), which then
// keeps the domain in a list.
//
// The host stays on the smoke account: it sets each test's mode and lists through the bot API
// (setunfurlsettings) and reads them back (getunfurlsettings). The Settings > Chat screen that saves
// them from the app is the settings flows' (saveUnfurlSettings): the prompt sends resolveUnfurlPrompt
// only. Every link goes to keybase.io, the one domain the service may fetch, carrying the run's
// stamp. The account's own settings are put back by the flow's afterEach, after a timeout too, and
// at the start of the next run when one died before it could.
import * as fs from 'fs'
import {loadE2EAccounts} from '../../accounts/env'
import {directConvIDFromCli} from '../../shared/chat-data'
import {cliChatApi, cliWhoami} from '../../shared/cli-account'
import {withCleanup} from '../../shared/cleanup.ts'
import {e2eMarker} from '../../shared/run-marker'
import * as T from '../../shared/test-ids'
import {currentCallSeq, waitForUiCall} from '../gate/recorder'
import {step} from '../gate/step'
import {
  closeMessageMenu,
  elementInRow,
  hideKeyboard,
  openConversation,
  requireThread,
  rowOf,
  sendMessage,
  storedUnfurls,
} from '../helpers/chat'
import {check} from '../helpers/menus'
import {expectHost} from '../helpers/chat-host'
import {waitFor} from '../helpers/lifecycle'

type Mode = 'always' | 'never' | 'whitelisted'
type UnfurlSettings = {blocklist: Array<string>; mode: Mode; whitelist: Array<string>}

// The account's settings from before the run, kept on disk until they are put back: the same file
// the desktop flow keeps them in, so a run of either that died is put right by the next run of either.
const savedSettingsPath = '/tmp/kb-e2e-chat-unfurl-settings.json'

// The service fetches a link only when it unfurls it, so every link is on keybase.io. The other
// domains are list entries only, never posted.
const fetchedDomain = 'keybase.io'
// the longest an unfurl or a prompt may take; a link must stay bare that long to count as bare
const unfurlTimeoutMs = 30_000
const bareWindowMs = unfurlTimeoutMs

const sorted = (s: UnfurlSettings): UnfurlSettings => ({
  blocklist: [...s.blocklist].sort(),
  mode: s.mode,
  whitelist: [...s.whitelist].sort(),
})
const same = (a: UnfurlSettings, b: UnfurlSettings) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b))

// Bound: one bot API call 30.
const getSettings = async (): Promise<UnfurlSettings> => {
  const r = (await cliChatApi({method: 'getunfurlsettings'})) as Partial<UnfurlSettings> & {mode: Mode}
  // only a service and CLI with block lists name the field
  if (!('blocklist' in r)) throw new Error('getunfurlsettings has no blocklist: KB_CLI must be the CLI built from this branch')
  return sorted({blocklist: r.blocklist ?? [], mode: r.mode, whitelist: r.whitelist ?? []})
}

// Sets the account's settings and reads them back. Bound: the set 30, the read 30.
const setSettings = async (s: UnfurlSettings) => {
  await cliChatApi({method: 'setunfurlsettings', params: {options: s}})
  const now = await getSettings()
  check(same(now, s), 'the link preview settings did not read back as set')
}

// The host's own account is the one whose settings this flow changes. Bound: 15.
const requireHostSmoke = async () => {
  const {smokeUser} = loadE2EAccounts()
  if (!smokeUser) throw new Error('KB_SMOKE_USER is not set')
  if ((await cliWhoami()) !== smokeUser) throw new Error("the host's keybase CLI is not KB_SMOKE_USER")
}

// The settings a died run left on disk, put back and the file removed. Bound: the set 60.
const restoreSavedSettings = async () => {
  if (!fs.existsSync(savedSettingsPath)) return
  const saved = JSON.parse(fs.readFileSync(savedSettingsPath, 'utf8')) as UnfurlSettings
  await setSettings(saved)
  fs.unlinkSync(savedSettingsPath)
}

describe('chat unfurl', function () {
  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   set       setSettings 60 (the set 30, its read 30);  read  getSettings 30;  polled  getSettings
  //             until it answers, 20 overrun by one read = 50
  //   open      openConversation 100;  sent  sendMessage 25;  id  a sent message's id 10;  keyboard  5
  //   prompt    the prompt in the store and on the row 30;  answer  the switch or a button found 5,
  //             its tap 1 = 6;  answered  the prompt gone 10
  //   calls     the recorder's call log, waited for 10;  seq  2
  //   unfurled  the preview in the store and on the row 30;  bare  30 from the post and one read 5 = 35
  //   step      2 (its 1s settle and the attach)
  this.retries(0)

  let smokeUser = ''
  let selfConvID = ''
  // the account's settings before the run
  let original: UnfurlSettings | undefined
  // set when a test changed the settings, cleared once the afterEach put the original back
  let changed = false

  before(async function () {
    // whoami 15, a died run's settings put back 60, the read 30, the self conversation's id 60
    this.timeout(180_000)
    await requireHostSmoke()
    smokeUser = loadE2EAccounts().smokeUser
    await restoreSavedSettings()
    original = await getSettings()
    fs.writeFileSync(savedSettingsPath, JSON.stringify(original))
    selfConvID = await directConvIDFromCli(smokeUser)
  })

  // The original settings back, read back. Bound: whoami 15, the read 30, the set 60 = 105.
  const restoreSettings = async () => {
    if (!changed || !original) return
    await requireHostSmoke()
    if (!same(await getSettings(), original)) await setSettings(original)
    changed = false
  }

  // Worst case (s): close 19, keyboard 5, the settings 105 = 129.
  afterEach(async function () {
    this.timeout(130_000)
    await withCleanup(closeMessageMenu, [hideKeyboard, restoreSettings])
  })

  // Once every test has run: the original settings back, and the file gone. Bound: 105.
  after(async function () {
    this.timeout(120_000)
    if (!original) return
    changed = true
    await restoreSettings()
    fs.rmSync(savedSettingsPath, {force: true})
  })

  // A test's own starting settings, set through the host. Bound: set 60.
  const startWith = async (s: UnfurlSettings) => {
    changed = true
    await setSettings(s)
  }

  type Posted = {at: number; ordinal: number}

  // Posts a message from the phone carrying a link to keybase.io, both unique to this post, and waits
  // for its id (the prompt and the preview are keyed by it). Bound: sent 25, id 10, keyboard 5.
  const postLink = async (tag: string): Promise<Posted> => {
    const marker = e2eMarker(`unfurl-${tag}`)
    const ordinal = await sendMessage(`${marker} https://${fetchedDomain}/?e2e=${marker}`)
    const at = Date.now()
    await waitFor('the link message id', async () => ((await storedUnfurls(ordinal))?.id ? true : undefined), {
      interval: 250,
      timeout: 10_000,
    })
    await hideKeyboard()
    return {at, ordinal}
  }

  // How many elements `selector` finds whose middle lies inside the row at `ordinal`.
  const inRow = async (selector: string, ordinal: number) => {
    const r = rowOf(await requireThread(), ordinal)
    if (!r) throw new Error(`row ${ordinal} is not drawn`)
    let n = 0
    for (const e of await browser.$$(selector).getElements()) {
      const at = await e.getLocation().catch(() => undefined)
      const size = await e.getSize().catch(() => undefined)
      if (at && size && at.y + size.height / 2 >= r.top && at.y + size.height / 2 <= r.bottom) n++
    }
    return n
  }

  const unfurlsOf = async (p: Posted) => {
    const u = await storedUnfurls(p.ordinal)
    if (!u) throw new Error(`the link message (row ${p.ordinal}) is not loaded`)
    return u
  }

  // The prompt for keybase.io on the row, in the store and drawn. Bound: prompt 30.
  const expectPrompt = async (p: Posted) =>
    waitFor(
      'the link preview prompt for keybase.io',
      async () => {
        const u = await unfurlsOf(p)
        if (u.unfurls) throw new Error('the link unfurled without asking')
        return u.prompts.includes(fetchedDomain) && (await inRow(`~${T.CHAT_UNFURL_PROMPT}`, p.ordinal)) === 1 ? true : undefined
      },
      {interval: 500, timeout: unfurlTimeoutMs}
    )

  // Answers the row's prompt, ticking Remember first when asked, and waits for the prompt to go and
  // the answer to go out. Bound: seq 2, the switch 6, the button 6, answered 10, calls 10 = 34.
  const answerPrompt = async (p: Posted, answer: 'yes' | 'no', remember: boolean) => {
    const seq = await currentCallSeq()
    if (remember) {
      const toggle = await elementInRow(`~${T.CHAT_UNFURL_PROMPT_REMEMBER}`, p.ordinal, "the prompt's Remember switch")
      await toggle.click()
    }
    const button = await elementInRow(
      `~${answer === 'yes' ? T.CHAT_UNFURL_PROMPT_YES : T.CHAT_UNFURL_PROMPT_NO}`,
      p.ordinal,
      `the prompt's ${answer === 'yes' ? 'Yes' : 'No'}`
    )
    await button.click()
    await waitFor(
      'the prompt to go',
      async () => ((await unfurlsOf(p)).prompts.length === 0 && (await inRow(`~${T.CHAT_UNFURL_PROMPT}`, p.ordinal)) === 0 ? true : undefined),
      {interval: 250, timeout: 10_000}
    )
    await waitForUiCall('the answer to go out', seq, 'chat.1.local.resolveUnfurlPrompt')
  }

  // The preview on the row, in the store and drawn, with no prompt. Bound: unfurled 30.
  const expectUnfurled = async (p: Posted) =>
    waitFor(
      'the link preview',
      async () => {
        const u = await unfurlsOf(p)
        if (u.prompts.length) throw new Error('the link asks for a preview it should post without asking')
        return u.unfurls === 1 && (await inRow(`~${T.CHAT_UNFURL_GENERIC}`, p.ordinal)) === 1 ? true : undefined
      },
      {interval: 500, timeout: unfurlTimeoutMs}
    )

  // Holds the row to no prompt and no preview until it has been up for as long as either may take to
  // come. Bound: bare 35.
  const expectBare = async (p: Posted) => {
    for (;;) {
      const u = await unfurlsOf(p)
      check(u.prompts.length === 0 && (await inRow(`~${T.CHAT_UNFURL_PROMPT}`, p.ordinal)) === 0, 'the link asks for a preview')
      check(u.unfurls === 0 && (await inRow(`~${T.CHAT_UNFURL_GENERIC}`, p.ordinal)) === 0, 'the link unfurled')
      if (Date.now() >= p.at + bareWindowMs) return
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  // The host's settings polled until `ok` takes them. Bound: polled 50.
  const expectSettings = async (what: string, ok: (s: UnfurlSettings) => boolean) =>
    expectHost(what, getSettings, ok)

  it('Ask per domain: No with Remember blocks keybase.io, and its next link neither prompts nor unfurls', async function () {
    // worst case (s): set 60, open 100, postLink 40, prompt 30, step 2, answer 34, polled 50, step 2,
    // postLink 40, bare 35, read 30, step 2 = 425
    this.timeout(460_000)
    await startWith({blocklist: ['example.org'], mode: 'whitelisted', whitelist: ['example.net']})
    await openConversation(selfConvID)
    const asked = await postLink('ask-no')
    await expectPrompt(asked)
    await step('The link asks to post a preview')
    await answerPrompt(asked, 'no', true)
    await expectSettings('keybase.io blocked', s => s.blocklist.includes(fetchedDomain) && !s.whitelist.includes(fetchedDomain))
    await step('No with Remember: no preview, and the host reads keybase.io blocked')

    const next = await postLink('ask-no-next')
    await expectBare(next)
    const s = await getSettings()
    check(s.blocklist.includes(fetchedDomain) && s.mode === 'whitelisted', 'the block list or mode changed under the bare link')
    await step('A blocked domain neither prompts nor unfurls', {card: true})
  })

  it('Ask per domain: Yes unfurls once and leaves the lists, and Yes with Remember allows keybase.io', async function () {
    // worst case (s): set 60, open 100, read 30; postLink 40, prompt 30, answer 34, unfurled 30, read
    // 30, step 2; postLink 40, prompt 30, answer 34, unfurled 30, polled 50, step 2 = 542
    this.timeout(600_000)
    await startWith({blocklist: ['example.org'], mode: 'whitelisted', whitelist: ['example.net']})
    await openConversation(selfConvID)
    const before = await getSettings()

    const once = await postLink('ask-yes-once')
    await expectPrompt(once)
    await answerPrompt(once, 'yes', false)
    await expectUnfurled(once)
    check(same(await getSettings(), before), 'Yes without Remember changed the lists')
    await step('Yes: the preview shows, and the lists are as they were')

    const remembered = await postLink('ask-yes-remember')
    await expectPrompt(remembered)
    await answerPrompt(remembered, 'yes', true)
    await expectUnfurled(remembered)
    await expectSettings(
      'keybase.io allowed',
      s => s.whitelist.includes(fetchedDomain) && JSON.stringify(s.blocklist) === JSON.stringify(before.blocklist)
    )
    await step('Yes with Remember: the preview shows, and the host reads keybase.io allowed', {card: true})
  })

  it('Allow all unfurls a blocked domain without asking', async function () {
    // worst case (s): set 60, open 100, postLink 40, unfurled 30, read 30, step 2 = 262
    this.timeout(290_000)
    await startWith({blocklist: [fetchedDomain, 'example.org'], mode: 'always', whitelist: ['example.net']})
    await openConversation(selfConvID)
    const posted = await postLink('always-blocked')
    await expectUnfurled(posted)
    check((await getSettings()).blocklist.includes(fetchedDomain), 'the block list lost keybase.io')
    await step('Allow all: the preview shows without a prompt', {card: true})
  })

  it('Disallow all neither prompts nor unfurls an allowed domain', async function () {
    // worst case (s): set 60, open 100, postLink 40, bare 35, read 30, step 2 = 267
    this.timeout(300_000)
    await startWith({blocklist: ['example.org'], mode: 'never', whitelist: [fetchedDomain]})
    await openConversation(selfConvID)
    const posted = await postLink('never-allowed')
    await expectBare(posted)
    check((await getSettings()).mode === 'never', 'the mode changed under the bare link')
    await step('Disallow all: the link stays bare', {card: true})
  })
})
