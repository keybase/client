import {expect} from '@wdio/globals'
import {escapeToTabs, navigateToMore} from '../helpers/navigate'
import {el, waitForTestID, byText} from '../helpers/elements'
import * as T from '../../shared/test-ids'

describe('git', () => {
  it('renders git repo list', async () => {
    await escapeToTabs()
    await navigateToMore()
    // Maestro: tapOn text: ".*Git" — label match for the Git menu item
    await byText('Git').click()
    await waitForTestID(T.GIT_REPO_LIST, 3000)
    await expect(el(T.GIT_REPO_LIST)).toExist()
  })

  it('shows a repo row when repos exist', async () => {
    await escapeToTabs()
    await navigateToMore()
    await byText('Git').click()
    await waitForTestID(T.GIT_REPO_LIST, 3000)

    await waitForTestID(T.GIT_REPO_ROW, 8000)
    await expect(el(T.GIT_REPO_ROW)).toExist()
  })
})
