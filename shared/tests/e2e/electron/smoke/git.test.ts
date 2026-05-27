import {test, expect, type Browser, type Page} from '@playwright/test'
import {connectToElectron, disconnect} from '../helpers/connect'
import {navigateToGit} from '../helpers/navigate'
import {GIT_REPO_LIST} from '../../shared/test-ids'

let browser: Browser
let page: Page

test.beforeAll(async () => {
  ;({browser, page} = await connectToElectron())
})

test.afterAll(async () => {
  await disconnect()
})

test('git tab renders', async () => {
  await navigateToGit(page)
  await expect(page.getByTestId(GIT_REPO_LIST)).toBeVisible()
})
