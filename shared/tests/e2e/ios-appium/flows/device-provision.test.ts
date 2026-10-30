import * as fs from 'fs'
import {loadE2EEnv, provisionHomeFor} from '../../accounts/env'
import {checkRetirablePeerHome, readPeerConfig, stopPeerHomeService} from '../../accounts/peer-homes'
import {startProvisionee, type Provisionee} from '../../accounts/provisionee'
import {provDeviceLabel} from '../../accounts/sweep-lib'
import {withCleanup} from '../../shared/cleanup.ts'
import {retirePhoneFlowDevice} from '../../shared/cli-device.ts'
import {withDeadline} from '../../shared/deadline'
import {activeDevices, provDeviceName, requireRevocableFromPhone, waitServiceRevoked} from '../../shared/devices.ts'
import {peerCli, peerUsesFileSecretStore, setPeerFileSecretStore, socketAnswers, socketPathFor, waitForPeerService} from '../../shared/peer-service'
import {e2eRunId} from '../../shared/run-marker'
import * as T from '../../shared/test-ids'
import {phoneDevice} from '../gate/accounts'
import {relaunchApp} from '../gate/device'
import {submitProvisionPhrase} from '../gate/secret-input'
import {manualEdge, step} from '../gate/step'
import {openDevicePage, openDevices, revokeOnPhone, waitNotListedActive} from '../helpers/devices'
import {el, labeled} from '../helpers/elements'
import {jsEval} from '../helpers/lifecycle'
import {escapeToTabs} from '../helpers/navigate'

// The phone approves a new computer: a fresh peer home (homes/prov-<runid>, the file secret store)
// runs `keybase login` as the smoke account, picks the phone as the device it provisions from and
// prints its verification phrase; the phone's Add a computer takes it, then revokes the new device.
// The phone's code page offers only a camera scan of the computer's code (or shows its own), and the
// simulator has no camera, so the phrase goes to the handler the scanner calls
// (submitProvisionPhrase) and the scan itself is the manual-only provision-qr-camera. Two secrets
// are about: the computer's phrase, which reaches the app only through that handler and is never
// logged, and the phone's own, which its code page shows as a QR the whole time it is up, so no step
// runs then and a code page that will not close is ended before any failure screenshot. Keybase
// never lets a device name be used twice, so this runs once per run id.
describe('device provision', function () {
  this.retries(0)

  // whichever tab it shows; on the phone the default is the QR tab, its link to the phrase "Type secret instead"
  const codePage = () => el(T.PROVISION_CODE_PAGE)
  const qrTab = () => browser.$('-ios predicate string:label == "Type secret instead"')

  // The code page is gone, whatever happened on it: the add-device run cancelled and its screens
  // closed, or the app relaunched. Runs before any error leaves the test.
  const closeCodePage = async () => {
    if (!(await codePage().isExisting())) return
    await jsEval<undefined>(`kbModule('provision/flow.tsx').cancelProvision()`).catch(() => {})
    await escapeToTabs().catch(() => {})
    if (await codePage().waitForExist({reverse: true, timeout: 10_000}).then(() => true, () => false)) return
    await relaunchApp()
    if (await codePage().isExisting()) throw new Error('the code page is still up after relaunching the app')
  }

  it('approves a computer that `keybase login` is provisioning, then revokes it', async function () {
    // the CLI's provisioning, the phone's, a shutdown, a list read and a revoke, each with its own deadline
    this.timeout(480_000)
    const env = loadE2EEnv()
    const runId = e2eRunId()
    const home = provisionHomeFor(runId, provDeviceLabel)
    const name = provDeviceName(runId, provDeviceLabel)
    const keep = env.peers.owner.home
    const phone = await phoneDevice()
    if (fs.existsSync(home)) throw new Error(`${home} already exists: this run id already provisioned its device (one per run id)`)

    let provisionee: Provisionee | undefined
    await withCleanup(
      async () => {
        // The file secret store before the home's service ever starts: peer homes share the Keychain
        // by username, so a home on it would overwrite the main service's stored secret.
        fs.mkdirSync(home, {mode: 0o700, recursive: true})
        setPeerFileSecretStore(home)
        if (!peerUsesFileSecretStore(home)) throw new Error(`${home} does not keep its secret in a file; refusing to start it`)
        await waitForPeerService('owner', home)
        if (!peerUsesFileSecretStore(home)) throw new Error(`${home}'s running service dropped the file secret store; refusing to log in`)

        await openDevices()
        await labeled('Other', 'Add a device or paper key').click()
        await el(T.DEVICES_ADD_DEVICE).waitForExist({timeout: 15_000})
        // the last screen before the code page: where a human scans the computer's QR instead
        await manualEdge('provision-qr-camera')

        provisionee = startProvisionee({deviceName: name, fromDevice: phone.deviceName, home, user: env.smokeUser})
        const cli = provisionee
        await withCleanup(
          async () => {
            // sends device.deviceAdd; its secret exchange opens the code page
            await labeled('Other', 'Add a computer').click()
            await codePage().waitForExist({timeout: 30_000, timeoutMsg: 'the code page did not open within 30s of Add a computer'})
            await qrTab().waitForExist({timeout: 10_000, timeoutMsg: 'the code page did not open on its QR tab'})
            const phrase = await withDeadline(cli.phrase, 60_000, 'the new home printing its verification phrase')
            await submitProvisionPhrase(phrase)
            await withDeadline(cli.done, 120_000, 'keybase login in the new home finishing')
            // the add-device run ends with the provisioning and clears its screens
            await codePage().waitForExist({reverse: true, timeout: 30_000, timeoutMsg: 'the code page stayed up after the computer signed in'})
          },
          [closeCodePage]
        )
        if ((await peerCli(home)(['whoami'], 15_000)) !== env.smokeUser) throw new Error(`${home} is not signed in as the smoke account after its login`)
        const deviceID = readPeerConfig(home).users?.[env.smokeUser]?.device ?? ''
        const listed = (await activeDevices()).filter(d => d.deviceID === deviceID)
        if (!deviceID || listed.length !== 1 || listed[0]?.name !== name || listed[0].type !== 'desktop') {
          throw new Error(`the service lists no active computer ${name} with the id ${home} holds`)
        }
        await el(T.DEVICES_LIST).waitForExist({timeout: 15_000, timeoutMsg: 'the app did not go back to the devices list'})
        await step('Back on the devices list once the computer signed in')

        await openDevicePage(name)
        await labeled('StaticText', 'Computer').waitForExist({timeout: 10_000})
        await step('The new computer has its device page', {card: true})

        // shut down before the revoke, so the device never acts on its own revoke
        checkRetirablePeerHome(home, keep)
        await stopPeerHomeService(home)
        if (await socketAnswers(socketPathFor(home))) throw new Error(`${home}'s service still answers after its shutdown`)
        await requireRevocableFromPhone(env, {deviceID, name}, phone.deviceID)
        // sends revoke.revokeDevice
        await revokeOnPhone(name, 'computer', async () => step('The revoke confirm names the computer'))
        await waitNotListedActive(name)
        await waitServiceRevoked(deviceID, 'the computer')
        await step('Back on the devices list, the computer no longer active')
      },
      [
        // a device the app did not revoke (the test failed first) is revoked under the phone's guard; the home goes
        async () => {
          provisionee?.kill()
          await retirePhoneFlowDevice(env, runId, provDeviceLabel, phone.deviceID)
        },
      ]
    )
    if (fs.existsSync(home)) throw new Error(`${home} is still there after its retirement`)
  })
})
