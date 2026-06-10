import {expect} from '@wdio/globals'
import {escapeToTabs, goBack} from '../helpers/navigate'
import {el, els, waitForTestID} from '../helpers/elements'
import * as T from '../../shared/test-ids'

describe('files folders', () => {
  it('navigates into each TLF folder and back', async () => {
    await escapeToTabs()
    // Maestro: tap Teams then Files to disambiguate from the More tab "Files" item
    await browser.$(`~Teams`).click()
    await browser.$(`~Files`).click()
    await waitForTestID(T.FILES_BROWSER, 3000)
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
