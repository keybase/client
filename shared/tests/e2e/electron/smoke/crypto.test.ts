import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {navigateToCrypto} from '@/tests/e2e/electron/helpers/navigate'
import {CRYPTO_INPUT} from '@/tests/e2e/shared/test-ids'

test('crypto tab renders', async ({page}) => {
  await navigateToCrypto(page)
  await expect(page.getByTestId(CRYPTO_INPUT).first()).toBeVisible()
})
