import {expect} from '@wdio/globals'
import {escapeToTabs, navigateToMore, tapSettingsRow} from '../helpers/navigate'
import {el, waitForTestID} from '../helpers/elements'
import * as T from '../../shared/test-ids'

describe('git', () => {
  it('renders the git repo list with a repo row', async () => {
    await escapeToTabs()
    await navigateToMore()
    await tapSettingsRow('Git')
    await waitForTestID(T.GIT_REPO_LIST, 3000)
    await expect(el(T.GIT_REPO_LIST)).toExist()

    // Wait for a real repo row to load (the smoke account has git repos).
    await waitForTestID(T.GIT_REPO_ROW, 8000)
    await expect(el(T.GIT_REPO_ROW)).toExist()
  })
})
