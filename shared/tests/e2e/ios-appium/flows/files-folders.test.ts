import {expect} from '@wdio/globals'
import {escapeToTabs, goBack} from '../helpers/navigate'
import {el, els, tab, waitForTestID} from '../helpers/elements'
import * as T from '../../shared/test-ids'

describe('files folders', () => {
  it('navigates into each TLF folder and back', async () => {
    await escapeToTabs()
    // Maestro: tap Teams then Files to disambiguate from the More tab "Files" item
    await tab('Teams').click()
    // The Files tab tap lands right after the Teams switch; on slow devices the
    // first tap is swallowed mid-transition (still on Teams), so retry. (Tab is
    // tapped by label, not testID, so use tab() not tapForTestID.)
    for (let i = 0; i < 3; i++) {
      await tab('Files').click().catch(() => {})
      if (
        await el(T.FILES_BROWSER)
          .waitForExist({timeout: 4000})
          .then(() => true)
          .catch(() => false)
      )
        break
    }
    await expect(el(T.FILES_BROWSER)).toExist()

    // TLF rows load after the browser mounts (KBFS can be slow) — wait for
    // them before indexing.
    await waitForTestID(T.FILES_TLF_ROW, 10000)

    // Navigate into private folder (index 0)
    await els(T.FILES_TLF_ROW)[0]!.click()
    await goBack()
    await waitForTestID(T.FILES_TLF_ROW, 3000)

    // Navigate into public folder (index 1)
    await els(T.FILES_TLF_ROW)[1]!.click()
    await goBack()
    await waitForTestID(T.FILES_TLF_ROW, 3000)

    // Navigate into team folder (index 2)
    await els(T.FILES_TLF_ROW)[2]!.click()
    await goBack()
    await waitForTestID(T.FILES_TLF_ROW, 3000)
    await expect(el(T.FILES_TLF_ROW)).toExist()
  })
})
