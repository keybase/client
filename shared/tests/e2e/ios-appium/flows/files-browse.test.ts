import {expect} from '@wdio/globals'
import {escapeToTabs} from '../helpers/navigate'
import {el, tab, waitForTestID} from '../helpers/elements'
import * as T from '../../shared/test-ids'

describe('files browse', () => {
  it('renders the files browser', async () => {
    await escapeToTabs()
    // Maestro: tap Teams then Files to disambiguate from the More tab "Files" item
    await tab('Teams').click()
    await tab('Files').click()
    await waitForTestID(T.FILES_BROWSER, 3000)
    await expect(el(T.FILES_BROWSER)).toExist()
  })
})
