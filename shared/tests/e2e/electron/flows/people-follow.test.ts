// Following and unfollowing the second account from each place the app offers it: the profile, the
// tracker window, and the profile card a username shows on hover; and the people search that leads
// to a profile. Only the second account is ever followed. Its follow state is read before the file
// runs and put back exactly after it, each change read back from `keybase list-following`.
import type {Locator, Page} from '@playwright/test'
import {loadE2EAccounts} from '@/tests/e2e/accounts/env'
import {clickUnoccluded, openDirectConversation, openUserProfile, rowByOrdinal, sendAsSecond, waitForRow} from '@/tests/e2e/electron/helpers/chat'
import {withCleanup} from '@/tests/e2e/electron/helpers/cleanup'
import {e2eMarker, expect, seedChatData, test} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToPeople} from '@/tests/e2e/electron/helpers/navigate'
import {button, expectFollowsSecond, followLabel, followsSecond, pressFollowChange, setFollowSecondFromCli, visibleProfile} from '@/tests/e2e/electron/helpers/people'
import {step} from '@/tests/e2e/electron/helpers/step'
import {closeRemoteWindow, openRemoteWindow, waitTrackerPropsGuiID} from '@/tests/e2e/electron/helpers/windows'
import {type ChatData} from '@/tests/e2e/shared/chat-data'
import * as T from '@/tests/e2e/shared/test-ids'

test.describe.configure({mode: 'serial'})
test.use({actionTimeout: 10_000})

let originallyFollows: boolean | undefined
test.beforeAll(async () => {
  originallyFollows = await followsSecond()
  await setFollowSecondFromCli(false)
})
test.afterAll(async () => {
  if (originallyFollows === undefined) return
  await setFollowSecondFromCli(originallyFollows)
})

const unfollowStep = async () => setFollowSecondFromCli(false)

// Pressing "Following" unfollows (its hover label is checked in people-follow-hover).
const unfollowFrom = async (page: Page, scope: Locator, what: string) =>
  pressFollowChange(page, false, what, async () => button(scope, 'Following').click())

test('follow from the profile', async ({page}, testInfo) => {
  test.setTimeout(120_000)
  const {secondUser} = loadE2EAccounts()
  await withCleanup(async () => {
    await openUserProfile(page, secondUser)
    const profile = visibleProfile(page)
    await expect(followLabel(profile)).toBeVisible({timeout: 15_000})
    await step(page, testInfo, 'second profile, not followed')
    await pressFollowChange(page, true, "the profile's Follow", async () => followLabel(profile).click())
    await expect(button(profile, 'Following')).toBeVisible({timeout: 15_000})
    await expectFollowsSecond(true, 'the second account in list-following after Follow')
    await step(page, testInfo, 'followed', {card: true})
    await unfollowFrom(page, profile, "the profile's Unfollow")
    await expect(followLabel(profile)).toBeVisible({timeout: 15_000})
    await expectFollowsSecond(false, 'the second account gone from list-following after Unfollow')
    await step(page, testInfo, 'unfollowed')
    // back to the tab's root, so a later visit to the tab does not land on this profile
    await navigateToPeople(page)
  }, [unfollowStep])
})

test('follow from the tracker window', async ({page}, testInfo) => {
  test.setTimeout(120_000)
  const {secondUser} = loadE2EAccounts()
  await withCleanup(async () => {
    const tracker = await openRemoteWindow(page.context(), page, 'tracker', {reason: 'You looked at this user', username: secondUser})
    try {
      const buttons = tracker.getByTestId(T.TRACKER_BUTTONS)
      const follow = button(buttons, 'Follow')
      await expect(follow).toBeVisible({timeout: 30_000})
      await step(tracker, testInfo, 'tracker window, not followed', {card: true})
      const latest = await pressFollowChange(page, true, "the tracker window's Follow", async () => follow.click())
      await expectFollowsSecond(true, 'the second account in list-following after the tracker Follow')
      // following, the window offers Close and Chat only
      await expect(follow).toHaveCount(0, {timeout: 15_000})
      await step(tracker, testInfo, 'tracker window, followed')
      // the window closes by the guiID in its props, which reach it up to a second late
      await waitTrackerPropsGuiID(tracker, latest)
    } finally {
      await closeRemoteWindow(tracker)
    }
    await openUserProfile(page, secondUser)
    const profile = visibleProfile(page)
    await unfollowFrom(page, profile, "the profile's Unfollow")
    await expect(followLabel(profile)).toBeVisible({timeout: 15_000})
    await expectFollowsSecond(false, 'the second account gone from list-following after Unfollow')
    await step(page, testInfo, 'unfollowed from the profile')
    // back to the tab's root, so a later visit to the tab does not land on this profile
    await navigateToPeople(page)
  }, [unfollowStep])
})

// The tests above add follow links to the smoke account's sigchain moments before, and the second
// peer's send loads that chain: until the server's chain catches up with its merkle tree the load
// fails ("Failed to reach (<link>, <seqno>) in server response") and nothing is sent, so that one
// error is tried again.
const sendAsSecondAfterFollows = async (convID: string, text: string) => {
  const deadline = Date.now() + 60_000
  for (;;) {
    try {
      await sendAsSecond(convID, text)
      return
    } catch (e) {
      if (!/Failed to reach \(\w+, \d+\) in server response/.test(String(e)) || Date.now() > deadline) throw e
      await new Promise(resolve => setTimeout(resolve, 3_000))
    }
  }
}

test.describe('profile card', () => {
  let data: ChatData
  test.beforeAll(async () => {
    data = await seedChatData()
  })

  test('profile card on hover', async ({page}, testInfo) => {
    test.setTimeout(120_000)
    const {secondUser} = data
    await withCleanup(async () => {
      const marker = e2eMarker('card')
      await sendAsSecondAfterFollows(data.direct.convID, marker)
      await openDirectConversation(page, secondUser)
      await waitForRow(page, marker, 30_000)
      // The author's name is drawn from data-virtual-text, so it has no text node to find. A message
      // right after another of theirs has no name over it: the name over their newest run of
      // messages is used, found by row ordinal (the list's DOM order is not its visual order).
      const nameSel = `[data-virtual-text="${secondUser}"]`
      const newest = await page.getByTestId(T.CHAT_MESSAGE_LIST).evaluate((list, sel) => {
        type Row = {getAttribute: (n: string) => string | null; querySelector: (s: string) => unknown}
        const rows = Array.from((list as unknown as {querySelectorAll: (s: string) => ArrayLike<Row>}).querySelectorAll('[data-ordinal]'))
        return Math.max(...rows.filter(r => r.querySelector(sel)).map(r => Number(r.getAttribute('data-ordinal'))))
      }, nameSel)
      const author = rowByOrdinal(page, newest).locator(nameSel)
      await author.hover()
      const card = page.getByTestId(T.FLOATING_MENU).filter({has: page.getByText('Chat', {exact: true})})
      await expect(card).toBeVisible({timeout: 10_000})
      await expect(followLabel(card)).toBeVisible({timeout: 15_000})
      await step(page, testInfo, 'profile card', {card: true})
      // An unfollow sent before the card's reloads after the follow end is refused ("outcome ...
      // wasn't ready"), so the press waits them out.
      const icons = card.getByTestId(T.PROFILE_CARD_SERVICE_ICONS)
      await expect(icons).toBeVisible({timeout: 15_000})
      await pressFollowChange(page, true, "the card's Follow", async () => clickUnoccluded(followLabel(card)))
      await expect(icons).toBeVisible({timeout: 30_000})
      await expectFollowsSecond(true, 'the second account in list-following after the card Follow')
      // the pointer is still where the Follow press left it: over the followed button, which reads
      // Unfollow under it and Following once the pointer moves off (to the card's service icons)
      await button(card, /^(Following|Unfollow)$/).hover()
      await expect(button(card, 'Unfollow')).toBeVisible({timeout: 15_000})
      await icons.hover()
      await expect(button(card, 'Following')).toBeVisible({timeout: 5_000})
      await step(page, testInfo, 'followed from the card')
      await unfollowFrom(page, card, "the card's Unfollow")
      await expectFollowsSecond(false, 'the second account gone from list-following after the card Unfollow')
      await expect(followLabel(card)).toBeVisible({timeout: 15_000})
      await step(page, testInfo, 'unfollowed from the card')
    }, [unfollowStep, async () => page.mouse.move(0, 0)])
  })
})

test('people search', async ({page}, testInfo) => {
  const {secondUser} = loadE2EAccounts()
  await navigateToPeople(page)
  // the header's filter (hint "Search people (⌘K)"): a clickable box over its input opens the search
  await page.locator('.search-filter').filter({has: page.getByPlaceholder(/^Search people/)}).locator('visible=true').first().click()
  const search = page.getByPlaceholder('Search Keybase').locator('visible=true')
  await expect(search).toBeVisible({timeout: 5_000})
  await search.fill(secondUser)
  const result = page.getByTestId(T.TEAM_BUILDING_RESULT_ROW).filter({has: page.getByText(secondUser, {exact: true})}).first()
  await expect(result).toBeVisible({timeout: 15_000})
  await step(page, testInfo, 'people search result', {card: true})
  await clickUnoccluded(result)
  const profile = visibleProfile(page)
  await expect(profile).toBeVisible({timeout: 10_000})
  await expect(profile.getByText(secondUser, {exact: true}).first()).toBeVisible({timeout: 10_000})
  await step(page, testInfo, 'second profile')
  await navigateToPeople(page)
})
