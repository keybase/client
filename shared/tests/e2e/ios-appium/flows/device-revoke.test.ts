import {loadE2EEnv} from '../../accounts/env'
import {provisionCliDevice, retireCliDevice, type CliDevice} from '../../shared/cli-device.ts'
import {deviceHistory, requireRevocableFromPhone} from '../../shared/devices.ts'
import {e2eRunId} from '../../shared/run-marker'
import {phoneDeviceId} from '../gate/accounts'
import {step} from '../gate/step'
import {labeled, openDevicePage, openDevices, revokeOnPhone, waitNotListedActive} from '../helpers/devices'
import {waitFor} from '../helpers/lifecycle'

// Revokes, from the phone, a computer the CLI provisioned for it (shared/cli-device.ts: a fresh home
// signed in as e2e-<runid>-cli, its service shut down). No retry: a device name is never used twice.
describe('device revoke', function () {
  this.retries(0)

  it('revokes a computer the CLI provisioned, from its device page', async function () {
    // the CLI's provisioning, a shutdown, a list read and a revoke, each with its own deadline
    this.timeout(420_000)
    const env = loadE2EEnv()
    const phoneID = await phoneDeviceId()
    let made: CliDevice | undefined
    let revokedByApp = false
    try {
      made = await provisionCliDevice(env, e2eRunId())
      const {deviceID, name} = made
      await openDevices()
      await openDevicePage(name)
      await labeled('StaticText', 'Computer').waitForExist({timeout: 10_000})
      await step('The CLI-provisioned computer has its device page', {card: true})

      await requireRevocableFromPhone(env, made, phoneID)
      // sends revoke.revokeDevice
      await revokeOnPhone(name, 'computer', async () => step('The revoke confirm names the computer'))
      await waitNotListedActive(name)
      await waitFor(
        'the service to list the computer as revoked',
        async () => ((await deviceHistory()).filter(d => d.deviceID === deviceID).map(d => d.revoked).join() === 'true' ? true : undefined),
        {interval: 1_000, timeout: 30_000}
      )
      revokedByApp = true
      await step('Back on the devices list, the computer no longer active')
    } finally {
      if (made) await retireCliDevice(env, made, phoneID, revokedByApp)
    }
  })
})
