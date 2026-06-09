import {expect} from '@wdio/globals'
import {escapeToTabs, navigateToMore} from '../helpers/navigate'
import {el, els, waitForTestID, byText} from '../helpers/elements'
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

    // Maestro: runFlow when visible git-repo-row — legitimately-absent data guard
    if ((await els(T.GIT_REPO_ROW).length) === 0) return // account has no git repos
    await expect(el(T.GIT_REPO_ROW)).toExist()
  })
})
