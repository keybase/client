// Advanced > "Always stay logged in", as the second account: off, read back after a reload, on
// again, read back after another. Turning it off can drop the second account's stored secret on the
// main service, so afterAll checks that secret and repairs it (a password login through the app)
// if it is gone; afterEach signs the smoke account in again if a failure left the app elsewhere.
import {loadE2EEnv, requireSecondPassword} from '@/tests/e2e/accounts/env'
import {CHECK_OR_REPAIR_WORST_MS, checkOrRepairSecondSecret} from '@/tests/e2e/accounts/second-password-lib'
import {asSecond, RESTORE_WORST_MS, restoreToSmoke} from '@/tests/e2e/electron/helpers/accounts'
import {withCleanup} from '@/tests/e2e/electron/helpers/cleanup'
import {test, expect} from '@/tests/e2e/electron/helpers/fixtures'
import {expectPersists} from '@/tests/e2e/electron/helpers/persisted'
import {appRepairDeps} from '@/tests/e2e/electron/helpers/second-sign-in'
import {clickCheckbox, isChecked, openAdvanced, openThen, serviceSays, settingsPage, shownOnceLoaded} from '@/tests/e2e/electron/helpers/settings'
import {step} from '@/tests/e2e/electron/helpers/step'
import {mainRpcAsSecond} from '@/tests/e2e/shared/main-rpc'
import {requireMainIsSmoke} from '@/tests/e2e/shared/peer-service'
import * as T from '@/tests/e2e/shared/test-ids'

// The repair types KB_SECOND_PASSWORD: a retry's trace snapshots every input's value, and a retry
// would type it again, so this file never retries and never traces.
test.describe.configure({retries: 0})
test.use({actionTimeout: 10_000, trace: 'off'})

test.afterEach(async ({page}, testInfo) => {
  testInfo.setTimeout(testInfo.timeout + RESTORE_WORST_MS)
  await restoreToSmoke(page)
})

// The repair signs in on this worker's own page (untraced, as above).
test.afterAll(async ({_electronPage}, testInfo) => {
  // the default 30s would kill a repair part way and leave the main service signed out
  testInfo.setTimeout(CHECK_OR_REPAIR_WORST_MS + 15_000)
  const env = loadE2EEnv()
  await checkOrRepairSecondSecret(env, requireSecondPassword(env), appRepairDeps(_electronPage))
  await requireMainIsSmoke(env)
})

const rememberLabel = 'Always stay logged in'
const remembered = async () => mainRpcAsSecond<boolean>('keybase.1.config.getRememberPassphrase', {sessionID: 0})

test('Advanced > remember password off, then on', async ({page}, testInfo) => {
  // two reloads and two saves, each read back
  testInfo.setTimeout(120_000)
  // refuses a rotation that stopped part way before anything changes
  requireSecondPassword(loadE2EEnv())
  const advanced = () => settingsPage(page, T.SETTINGS_ADVANCED)
  const shown = async () => openThen(page, openAdvanced, async () => shownOnceLoaded(async () => isChecked(advanced(), rememberLabel), remembered, 'remember password'))
  const toggle = async (want: boolean) => {
    await clickCheckbox(advanced(), rememberLabel)
    await serviceSays(remembered, want, 'remember password, from the main service')
  }
  await asSecond(page, async () =>
    withCleanup(
      async () => {
        expect(await remembered(), 'remember password starts on for the second account').toBe(true)
        expect(await shown(), 'the setting shown').toBe(true)
        await toggle(false)
        await step(page, testInfo, 'remember password off', {card: true})
        await expectPersists(page, shown, false, 'remember password')
        await toggle(true)
        await expectPersists(page, shown, true, 'remember password, restored')
      },
      [
        async () => {
          if (await remembered()) return
          await mainRpcAsSecond('keybase.1.config.setRememberPassphrase', {remember: true, sessionID: 0})
          expect(await remembered(), 'remember password after the restore').toBe(true)
        },
      ]
    )
  )
})
