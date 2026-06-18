import {expect} from '@wdio/globals'
import {escapeToTabs, goBack} from '../helpers/navigate'
import {el, els, tab, waitForTestID} from '../helpers/elements'
import * as T from '../../shared/test-ids'

describe('files folders', () => {
  it('navigates into each TLF folder and back', async () => {
    await escapeToTabs()
    // Tap Teams then Files to disambiguate from the More tab "Files" item.
    await tab('Teams').click()
    // The Files tab keeps its own nav stack and the app restores it: a prior flow
    // can leave Files pushed INSIDE a TLF (e.g. "private"), and FILES_BROWSER also
    // exists inside subfolders — so a loop that breaks on FILES_BROWSER would stop
    // one level deep and never reach the root TLF list. Wait on the root-only
    // FILES_TLF_ROW instead, re-tapping Files each round: the first tap switches
    // from Teams to Files (possibly mid-transition, or restored deep) and
    // re-tapping the already-focused tab pops its stack to root (same idiom as
    // navigateToMore). KBFS can be slow to stream the rows in, so wait generously.
    for (let i = 0; i < 4; i++) {
      await tab('Files').click().catch(() => {})
      if (
        await el(T.FILES_TLF_ROW)
          .waitForExist({timeout: 6000, interval: 150})
          .then(() => true)
          .catch(() => false)
      )
        break
    }
    await expect(el(T.FILES_TLF_ROW)).toExist()

    // goBack is single-shot; on slow old sims the back tap is swallowed mid-
    // transition, leaving us inside the TLF (FILES_TLF_ROW lives only on the
    // top-level type rows, so it stays absent). Retry back until the root rows
    // reappear before indexing the next folder.
    const backToRoot = async () => {
      for (let i = 0; i < 4; i++) {
        await goBack()
        if (
          await el(T.FILES_TLF_ROW)
            .waitForExist({timeout: 3000, interval: 150})
            .then(() => true)
            .catch(() => false)
        )
          return
      }
      await waitForTestID(T.FILES_TLF_ROW, 3000)
    }

    // Navigate into private folder (index 0)
    await els(T.FILES_TLF_ROW)[0]!.click()
    await backToRoot()

    // Navigate into public folder (index 1)
    await els(T.FILES_TLF_ROW)[1]!.click()
    await backToRoot()

    // Navigate into team folder (index 2)
    await els(T.FILES_TLF_ROW)[2]!.click()
    await backToRoot()
    await expect(el(T.FILES_TLF_ROW)).toExist()
  })
})
