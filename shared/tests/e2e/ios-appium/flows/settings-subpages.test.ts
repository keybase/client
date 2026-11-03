// The settings pages the phone's More list opens, one test per row, view only: each row opens its
// page, read by its route and its testID. Feedback is opened and its Send is seen, never pressed; the
// Wallet page is read by its testID alone (payments are no longer supported). About's "Terms and
// Conditions" opens the in-app keybase.io view (webLinks) and goes back to About.
import * as T from '../../shared/test-ids'
import {step} from '../gate/step'
import {hideKeyboard} from '../helpers/chat'
import {el} from '../helpers/elements'
import {expectScreen} from '../gate/screens'
import {waitFor} from '../helpers/lifecycle'
import {check, labelledElement, onScreen} from '../helpers/menus'
import {escapeToTabs, goBack, navigateToMore, scrollToTestID, tapSettingsRow} from '../helpers/navigate'

const TERMS = 'https://keybase.io/_/webview/terms'
const WEB_VIEW = '-ios predicate string:type == "XCUIElementTypeWebView"'
const SEND = '-ios predicate string:type == "XCUIElementTypeButton" AND label == "Send"'

type Page = {
  // the More list row's label, and the row's own testID where its text is also a tab's label
  row: string
  rowTestID?: string
  route: string
  marker: string
}

const PAGES: ReadonlyArray<Page> = [
  {marker: T.SETTINGS_ACCOUNT_PAGE, route: 'settingsTabs.accountTab', row: 'Account'},
  {marker: T.SETTINGS_ADVANCED, route: 'settingsTabs.advancedTab', row: 'Advanced'},
  {marker: T.SETTINGS_ARCHIVE, route: 'settingsTabs.archiveTab', row: 'Backup'},
  {marker: T.SETTINGS_CHAT, route: 'settingsTabs.chatTab', row: 'Chat', rowTestID: T.SETTINGS_ROW_CHAT},
  {marker: T.SETTINGS_DISPLAY, route: 'settingsTabs.displayTab', row: 'Display'},
  {marker: T.SETTINGS_FEEDBACK, route: 'settingsTabs.feedbackTab', row: 'Feedback'},
  {marker: T.SETTINGS_FILES, route: 'settingsTabs.fsTab', row: 'Files', rowTestID: T.SETTINGS_ROW_FILES},
  {marker: T.SETTINGS_NOTIFICATIONS, route: 'settingsTabs.notificationsTab', row: 'Notifications'},
  {marker: T.SETTINGS_WALLET, route: 'settingsTabs.walletsTab', row: 'Wallet'},
  {marker: T.SETTINGS_ABOUT, route: 'settingsTabs.aboutTab', row: 'About'},
]

describe('settings subpages', function () {
  // Each test's timeout is the sum of its helpers' bounds (s), so its own checks always fail first:
  //   more      escapeToTabs 30, the More tab 20 = 50;  row  scrolled to 54 and tapped 1
  //   screen    expectScreen 11;  marker  10;  label  a labelled element read 1, waited for 6
  //   back      goBack 3;  step  2 (its 1s settle and the attach)

  // Feedback's field can raise the keyboard. Bound: the keyboard 5, escapeToTabs 30 = 35.
  afterEach(async function () {
    this.timeout(60_000)
    await hideKeyboard()
    await escapeToTabs()
  })

  // The page from the More list. Bound: more 50, row 55, screen 11, marker 10 = 126.
  const openPage = async ({marker, route, row, rowTestID}: Page) => {
    await escapeToTabs()
    await navigateToMore()
    if (rowTestID) {
      await scrollToTestID(rowTestID)
      await el(rowTestID).click()
    } else {
      await tapSettingsRow(row)
    }
    await expectScreen(`the ${row} settings page`, route)
    await el(marker).waitForExist({timeout: 10_000, timeoutMsg: `the ${row} settings page never drew`})
  }

  for (const page of PAGES) {
    it(`the More list's ${page.row} row opens its page`, async function () {
      // worst case (s): openPage 126, the keyboard 5, the Send 6, step 2 = 139
      this.timeout(150_000)
      await openPage(page)
      // the page's own Send, seen on screen and never pressed: it sends the phone's logs. The page
      // focuses its field (the keyboard can cover Send), and XCUITest can report the page's button
      // visible=false, so its frame on screen stands for visible.
      if (page.marker === T.SETTINGS_FEEDBACK) {
        await hideKeyboard()
        await waitFor(
          "the Feedback page's Send",
          async () => {
            const on: Array<WebdriverIO.Element> = []
            for (const e of await browser.$$(SEND).getElements()) if (await onScreen(e)) on.push(e)
            return on.length === 1 ? true : undefined
          },
          {interval: 250, timeout: 5_000}
        )
      }
      await step(`The ${page.row} settings page`, {card: true})
    })
  }

  it("About's Terms and Conditions open the in-app keybase.io view, and back to About", async function () {
    // worst case (s): openPage 126, step 2, the link 6 and its tap 1, screen 11, the web view 10, step
    // 2, back 3, screen 11, marker 10, the web view read 1, step 2 = 185
    this.timeout(200_000)
    const about = PAGES.find(p => p.marker === T.SETTINGS_ABOUT)!
    await openPage(about)
    await step('About')
    const link = await waitFor(
      'the Terms and Conditions link',
      async () =>
        labelledElement(
          '-ios predicate string:(type == "XCUIElementTypeStaticText" OR type == "XCUIElementTypeLink") AND label == "Terms and Conditions" AND visible == 1',
          'Terms and Conditions',
          'the Terms and Conditions link'
        ),
      {interval: 250, timeout: 5_000}
    )
    await link.click()
    await expectScreen('the in-app Terms view', 'webLinks', p => p['url'] === TERMS && p['title'] === 'Terms')
    await browser.$(WEB_VIEW).waitForExist({timeout: 10_000, timeoutMsg: 'the in-app Terms view has no web view'})
    await step('The in-app Terms view', {card: true})

    await goBack()
    await expectScreen('About again', about.route)
    await el(T.SETTINGS_ABOUT).waitForExist({timeout: 10_000})
    check(!(await browser.$(WEB_VIEW).isExisting()), 'the Terms view is still drawn over About')
    await step('Back on About')
  })
})
