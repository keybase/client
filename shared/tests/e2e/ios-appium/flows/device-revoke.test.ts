import {loadE2EEnv} from '../../accounts/env'
import {withCleanup} from '../../shared/cleanup.ts'
import {provisionCliDevice, retireCliDevice} from '../../shared/cli-device.ts'
import {requireRevocableFromPhone, waitServiceRevoked} from '../../shared/devices.ts'
import {e2eRunId} from '../../shared/run-marker'
import {phoneDeviceId} from '../gate/accounts'
import {step} from '../gate/step'
import {openDevicePage, openDevices, revokeOnPhone, waitNotListedActive} from '../helpers/devices'
import {labeled} from '../helpers/elements'

// Revokes, from the phone, a computer the CLI provisioned for it (shared/cli-device.ts: a fresh home
// signed in as e2e-<runid>-cli, its service shut down). No retry: a device name is never used twice.
describe('device revoke', function () {
  this.retries(0)

  // The device's retirement, once the test knows what to retire. Idempotent: the test's own cleanup
  // and the afterEach both run it, and a device already revoked and its home gone leave it nothing.
  let retire: (() => Promise<void>) | undefined

  // Mocha runs this before the gate's own afterEach, also after a timeout that abandoned the test
  // before its cleanup.
  afterEach(async function () {
    // the home's shutdown 30, the revoke and its check 30, the home's removal 10 = 70
    this.timeout(120_000)
    const r = retire
    retire = undefined
    await r?.()
  })

  it('revokes a computer the CLI provisioned, from its device page', async function () {
    // Worst case from the helpers' bounds (s), so the cleanups always get to run: the phone's device
    // 15, provisionCliDevice 265 (the home's service 30, the login 180, whoami 15, the list 10, its
    // shutdown 30), openDevices 45, openDevicePage 275 (findDeviceRow 250, the page 25), its label
    // 10, the revoke guard 20, revokeOnPhone 95, not listed active 30, revoked 30, three steps 15 =
    // 800. Cleanup: retireCliDevice 70. Total 870.
    this.timeout(970_000)
    const env = loadE2EEnv()
    const runId = e2eRunId()
    const phoneID = await phoneDeviceId()
    // from the home, so a provisioning that failed after its login still has its device revoked
    const retireThis = async () => retireCliDevice(env, runId, phoneID)
    retire = retireThis
    await withCleanup(
      async () => {
        const made = await provisionCliDevice(env, runId)
        const {deviceID, name} = made
        await openDevices()
        await openDevicePage(name)
        await labeled('StaticText', 'Computer').waitForExist({timeout: 10_000})
        await step('The CLI-provisioned computer has its device page', {card: true})

        await requireRevocableFromPhone(env, made, phoneID)
        // sends revoke.revokeDevice
        await revokeOnPhone(name, 'computer', async () => step('The revoke confirm names the computer'))
        await waitNotListedActive(name)
        await waitServiceRevoked(deviceID, 'the computer')
        await step('Back on the devices list, the computer no longer active')
      },
      [retireThis]
    )
  })
})
