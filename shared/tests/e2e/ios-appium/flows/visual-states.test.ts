import {expect} from '@wdio/globals'
import {escapeToTabs, navigateToMore, navigateToTeams, navigateToFiles, navigateToPeople, goBack, scrollDownToText, tapSettingsRow, tabTo} from '../helpers/navigate'
import {byText, el, els, anyExist, waitForTestID, tab, enterText, tapForTestID} from '../helpers/elements'
import * as T from '../../shared/test-ids'

// Visual-coverage states. The harness screenshots AFTER each test and
// escapeToTabs resets before the next one, so each test ENDS at the state it
// wants captured (modal left open on purpose). View-only: nothing submits.

// Swipe from mid-screen upward-content (finger down) to reveal older content.
async function swipeContentDown(times: number): Promise<void> {
  const {width, height} = await browser.getWindowRect()
  const x = Math.round(width * 0.5)
  for (let i = 0; i < times; i++) {
    await browser
      .action('pointer')
      .move({x, y: Math.round(height * 0.35)})
      .down()
      .move({x, y: Math.round(height * 0.75), duration: 300})
      .up()
      .perform()
  }
}

// Finger up — scrolls the content toward its bottom.
async function swipeContentUp(times: number): Promise<void> {
  const {width, height} = await browser.getWindowRect()
  const x = Math.round(width * 0.5)
  for (let i = 0; i < times; i++) {
    await browser
      .action('pointer')
      .move({x, y: Math.round(height * 0.75)})
      .down()
      .move({x, y: Math.round(height * 0.35), duration: 300})
      .up()
      .perform()
  }
}

// Open the conversation info panel from inside a conversation. iOS 26 folds
// Search/Info into one native "More" header menu (native UIMenu items ARE
// accessible); Android keeps the plain info icon in the RN header, reached by
// its testID. Returns false when the affordance isn't there (e.g. pending conv).
async function openInfoPanel(): Promise<boolean> {
  if (browser.isAndroid) {
    const info = el(T.CHAT_HEADER_INFO_BUTTON)
    if (!(await info.waitForExist({timeout: 4000}).then(() => true).catch(() => false))) return false
    await info.click()
  } else {
    const more = el('More')
    if (!(await more.waitForExist({timeout: 4000}).then(() => true).catch(() => false))) return false
    await more.click()
    const info = byText('Info')
    if (!(await info.waitForExist({timeout: 4000}).then(() => true).catch(() => false))) return false
    await info.click()
  }
  return true
}

async function openFirstConversation(): Promise<boolean> {
  // Two-tap idiom: sidestep the ambiguous "Chat" label in the More stack.
  await tab('Teams').click().catch(() => {})
  await tabTo('Chat', T.CHAT_INBOX_LIST)
  if (!(await anyExist(T.CHAT_INBOX_ROW))) return false
  await els(T.CHAT_INBOX_ROW)[0]!.click()
  await waitForTestID(T.CHAT_MESSAGE_LIST, 5000)
  return true
}

describe('visual states', () => {
  it('new chat team builder', async () => {
    await escapeToTabs()
    await tab('Teams').click().catch(() => {})
    await tabTo('Chat', T.CHAT_INBOX_LIST)
    await byText('New chat').click()
    // phone builder has no "Recommendations" header and the service-tab labels
    // are comma-merged (", A phone, number") — anchor on the self row instead
    await byText('Write secure notes to yourself').waitForExist({timeout: 8000})
    await expect(byText('Write secure notes to yourself')).toExist()
  })

  it('conversation scrolled up', async () => {
    await escapeToTabs()
    if (!(await openFirstConversation())) return
    await swipeContentDown(3)
    await expect(el(T.CHAT_MESSAGE_LIST)).toExist()
  })

  it('archive backup modal', async () => {
    await escapeToTabs()
    await navigateToMore()
    await tapSettingsRow('Backup')
    await waitForTestID(T.SETTINGS_ARCHIVE, 5000)
    await byText('Backup all chat').click()
    await byText('Share a copy of your content to another app').waitForExist({timeout: 5000})
    await expect(byText('Share a copy of your content to another app')).toExist()
  })

  it('wallet screen', async () => {
    await escapeToTabs()
    await navigateToMore()
    await tapSettingsRow('Wallet')
    await byText('Secret key').waitForExist({timeout: 8000})
    await expect(byText('Secret key')).toExist()
  })

  it('password screen', async () => {
    await escapeToTabs()
    await navigateToMore()
    await tapSettingsRow('Account')
    await byText('Email & phone').waitForExist({timeout: 5000})
    // mobile label is just "Change" (desktop says "Change password")
    const change = byText('Change')
    if (!(await change.isExisting())) {
      // randomPW accounts show "Set a password" instead
      await byText('Set a password').click()
    } else {
      await change.click()
    }
    // input placeholders aren't labels in the XCUITest tree — anchor on the checkbox
    await byText('Show typing').waitForExist({timeout: 5000})
    await expect(byText('Show typing')).toExist()
  })

  it('add device chooser', async () => {
    await escapeToTabs()
    await navigateToMore()
    await tapSettingsRow('Devices')
    await waitForTestID(T.DEVICES_LIST, 5000)
    await byText('Add a device or paper key').click()
    await byText('Protect your account by having more devices and paper keys.').waitForExist({
      timeout: 5000,
    })
    await expect(byText('Protect your account by having more devices and paper keys.')).toExist()
  })

  it('git new repo menu', async () => {
    await escapeToTabs()
    await navigateToMore()
    await tapSettingsRow('Git')
    await waitForTestID(T.GIT_REPO_LIST, 5000)
    await byText('New encrypted git repository...').click()
    // The sheet's menu items are NOT in the accessibility tree (FloatingMenu
    // bottom-sheet items are a11y-invisible — real VoiceOver gap), so we can't
    // tap through to the form. Capture the open-menu state instead.
    await byText('Bottom Sheet').waitForExist({timeout: 8000})
    await expect(byText('Bottom Sheet')).toExist()
  })

  it('conversation info panel', async () => {
    await escapeToTabs()
    if (!(await openFirstConversation())) return
    if (!(await openInfoPanel())) return
    await waitForTestID(T.CHAT_INFO_PANEL, 8000)
    await expect(el(T.CHAT_INFO_PANEL)).toExist()
  })

  it('delete history warning', async () => {
    await escapeToTabs()
    if (!(await openFirstConversation())) return
    if (!(await openInfoPanel())) return
    await waitForTestID(T.CHAT_INFO_PANEL, 8000)
    // the tab label text isn't tappable on iOS — the tab carries its own testID
    if (!(await el(T.CHAT_INFO_PANEL_SETTINGS_TAB).waitForExist({timeout: 4000}).then(() => true).catch(() => false))) {
      return // no settings tab without admin rights
    }
    await el(T.CHAT_INFO_PANEL_SETTINGS_TAB).click()
    await scrollDownToText('Clear entire conversation')
    await byText('Clear entire conversation').click()
    await byText('Yes, clear for everyone').waitForExist({timeout: 5000})
    await expect(byText('Yes, clear for everyone')).toExist()
  })

  it('mention suggestions popup', async () => {
    await escapeToTabs()
    if (!(await openFirstConversation())) return
    await waitForTestID(T.CHAT_INPUT, 5000)
    await enterText(T.CHAT_INPUT, '@cn')
    await waitForTestID(T.CHAT_SUGGESTION_LIST, 8000)
    await expect(el(T.CHAT_SUGGESTION_LIST)).toExist()
  })

  it('mention suggestions cleanup', async () => {
    // paired with the test above: clear the draft it left so inbox rows don't
    // show "Draft:" noise in later screenshots; this shot = clean conversation
    await escapeToTabs()
    if (!(await openFirstConversation())) return
    await waitForTestID(T.CHAT_INPUT, 5000)
    await el(T.CHAT_INPUT).clearValue()
    await browser.pause(500)
    await expect(el(T.CHAT_MESSAGE_LIST)).toExist()
  })

  it('attachment fullscreen', async () => {
    await escapeToTabs()
    await tab('Teams').click().catch(() => {})
    await tabTo('Chat', T.CHAT_INBOX_LIST)
    // hunt inbox rows for a conversation with an image attachment
    for (let i = 0; i < 6; i++) {
      const rows = els(T.CHAT_INBOX_ROW)
      if ((await rows.length) <= i) break
      await rows[i]!.click()
      await waitForTestID(T.CHAT_MESSAGE_LIST, 5000)
      if (await anyExist(T.CHAT_ATTACHMENT_IMAGE, 2500)) {
        const images = els(T.CHAT_ATTACHMENT_IMAGE)
        await images[(await images.length) - 1]!.click()
        await waitForTestID(T.CHAT_ATTACHMENT_FULLSCREEN, 8000)
        await expect(el(T.CHAT_ATTACHMENT_FULLSCREEN)).toExist()
        return
      }
      await goBack()
      await waitForTestID(T.CHAT_INBOX_LIST, 5000)
    }
  })

  it('settings advanced scrolled', async () => {
    await escapeToTabs()
    await navigateToMore()
    await tapSettingsRow('Advanced')
    await waitForTestID(T.SETTINGS_ADVANCED, 5000)
    await swipeContentUp(4)
    await expect(el(T.SETTINGS_ADVANCED)).toExist()
  })

  it('files folder overflow menu', async () => {
    await escapeToTabs()
    await navigateToFiles()
    // the native More menu only exists inside a TLF (hidden at the files root)
    if (!(await anyExist(T.FILES_TLF_ROW, 5000))) return
    await els(T.FILES_TLF_ROW)[0]!.click()
    await browser.pause(1000)
    const more = el('More')
    if (!(await more.waitForExist({timeout: 4000}).then(() => true).catch(() => false))) return
    await more.click()
    await browser.pause(800)
    await expect(el(T.FILES_BROWSER)).toExist()
  })

  it('account switcher', async () => {
    await escapeToTabs()
    await navigateToPeople()
    await el(T.PEOPLE_HEADER_AVATAR).click()
    await byText('Log in as another user').waitForExist({timeout: 8000})
    await expect(byText('Log in as another user')).toExist()
  })

  it('emoji picker', async () => {
    await escapeToTabs()
    if (!(await openFirstConversation())) return
    await waitForTestID(T.CHAT_EMOJI_BUTTON, 5000)
    await el(T.CHAT_EMOJI_BUTTON).click()
    await waitForTestID(T.CHAT_EMOJI_PICKER, 8000)
    await expect(el(T.CHAT_EMOJI_PICKER)).toExist()
  })

  it('command suggestions popup', async () => {
    await escapeToTabs()
    if (!(await openFirstConversation())) return
    await waitForTestID(T.CHAT_INPUT, 5000)
    await enterText(T.CHAT_INPUT, '/')
    await waitForTestID(T.CHAT_SUGGESTION_LIST, 8000)
    await expect(el(T.CHAT_SUGGESTION_LIST)).toExist()
  })

  it('command suggestions cleanup', async () => {
    await escapeToTabs()
    if (!(await openFirstConversation())) return
    await waitForTestID(T.CHAT_INPUT, 5000)
    await el(T.CHAT_INPUT).clearValue()
    await browser.pause(500)
    await expect(el(T.CHAT_MESSAGE_LIST)).toExist()
  })

  it('inbox scrolled to bottom', async () => {
    await escapeToTabs()
    await tab('Teams').click().catch(() => {})
    await tabTo('Chat', T.CHAT_INBOX_LIST)
    await swipeContentUp(5)
    await expect(el(T.CHAT_INBOX_LIST)).toExist()
  })

  it('team members scrolled', async () => {
    await escapeToTabs()
    await navigateToTeams()
    await waitForTestID(T.TEAMS_ROW, 8000)
    await els(T.TEAMS_ROW)[0]!.click()
    await tapForTestID(T.TEAMS_TAB_MEMBERS_BUTTON, T.TEAMS_MEMBER_LIST, {timeout: 10000})
    await swipeContentUp(4)
    await expect(el(T.TEAMS_MEMBER_LIST)).toExist()
  })

  it('settings notifications scrolled', async () => {
    await escapeToTabs()
    await navigateToMore()
    await scrollDownToText('Notifications')
    await byText('Notifications').click()
    await waitForTestID(T.SETTINGS_NOTIFICATIONS, 5000)
    await swipeContentUp(4)
    await expect(el(T.SETTINGS_NOTIFICATIONS)).toExist()
  })

  it('edit team info modal', async () => {
    await escapeToTabs()
    await navigateToTeams()
    await waitForTestID(T.TEAMS_ROW, 8000)
    await els(T.TEAMS_ROW)[0]!.click()
    const edit = byText('Edit')
    if (!(await edit.waitForExist({timeout: 5000}).then(() => true).catch(() => false))) return
    await edit.click()
    await byText('Save').waitForExist({timeout: 5000})
    await expect(byText('Save')).toExist()
  })

  it('team add members wizard', async () => {
    await escapeToTabs()
    await navigateToTeams()
    await waitForTestID(T.TEAMS_ROW, 8000)
    await els(T.TEAMS_ROW)[0]!.click()
    const addButton = byText('Add/Invite people')
    if (!(await addButton.waitForExist({timeout: 5000}).then(() => true).catch(() => false))) {
      await goBack()
      return
    }
    await addButton.click()
    await byText('A list of email addresses').waitForExist({timeout: 5000})
    await expect(byText('A list of email addresses')).toExist()
  })
})
