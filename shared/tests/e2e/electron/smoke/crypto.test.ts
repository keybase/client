import {test, expect, type Page} from '@playwright/test'
import {connectToElectron, disconnect} from '../helpers/connect'
import {navigateToCrypto} from '../helpers/navigate'
import {CRYPTO_INPUT} from '../../shared/test-ids'

let page: Page

test.beforeAll(async () => {
  ;({page} = await connectToElectron())
})

test.afterAll(async () => {
  await disconnect()
})

test('crypto tab renders', async () => {
  await navigateToCrypto(page)
  await expect(page.getByTestId(CRYPTO_INPUT)).toBeVisible()
})
