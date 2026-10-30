import * as fs from 'fs'
import {loadE2EEnv, provisionHomeFor} from '../../accounts/env'
import {checkRetirablePeerHome, readPeerConfig, stopPeerHomeService} from '../../accounts/peer-homes'
import {startProvisionee, type Provisionee} from '../../accounts/provisionee'
import {provDeviceLabel} from '../../accounts/sweep-lib'
import {withCleanup} from '../../shared/cleanup.ts'
import {retirePhoneFlowDevice} from '../../shared/cli-device.ts'
import {withDeadline} from '../../shared/deadline'
import {activeDevices, provDeviceName, requireRevocableFromPhone, waitServiceRevoked} from '../../shared/devices.ts'
import {peerCli, socketAnswers, socketPathFor, startFileStoreHome} from '../../shared/peer-service'
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

  // The new home's retirement, once the test knows what to retire. Idempotent: the test's own
  // cleanup and the afterEach both run it, and a device already revoked and its home gone leave it
  // nothing.
  let retire: (() => Promise<void>) | undefined

  // Mocha runs this before the gate's own afterEach (and its failure screenshot), also after a
  // timeout that abandoned the test before its cleanup: the code page and its QR go first, then
  // the new device and its home.
  afterEach(async function () {
    // closing the code page 125 (the cancel 15, escapeToTabs 30, its close 10, a relaunch 70), the
    // home's shutdown 30, the revoke and its check 30, the home's removal 10 = 195
    this.timeout(300_000)
    await closeCodePage()
    const r = retire
    retire = undefined
    await r?.()
  })

  it('approves a computer that `keybase login` is provisioning, then revokes it', async function () {
    // Worst case from the helpers' bounds (s), so the cleanups always get to run: the phone's device
    // 15, the home's service 30, openDevices 45, the chooser 20, the manual edge 5, the code page 40,
    // the phrase 60, its submit 30, the CLI's login 120, the code page closing 30, whoami 15, the
    // list 10, the devices list 15, openDevices again 45, openDevicePage 265 (findDeviceRow 240, the
    // page 25), its label 10, the shutdown 30, the revoke guard 20, revokeOnPhone 95, not listed
    // active 30, revoked 30, three steps 15 = 975. Cleanups: closing the code page 125, the
    // retirement 70 = 195. Total 1170.
    this.timeout(1_200_000)
    const env = loadE2EEnv()
    const runId = e2eRunId()
    const home = provisionHomeFor(runId, provDeviceLabel)
    const name = provDeviceName(runId, provDeviceLabel)
    const keep = env.peers.owner.home
    const phone = await phoneDevice()
    if (fs.existsSync(home)) throw new Error(`${home} already exists: this run id already provisioned its device (one per run id)`)

    let provisionee: Provisionee | undefined
    // a device the app did not revoke (the test failed first) is revoked under the phone's guard; the home goes
    const retireThis = async () => {
      provisionee?.kill()
      await retirePhoneFlowDevice(env, runId, provDeviceLabel, phone.deviceID)
    }
    retire = retireThis
    await withCleanup(
      async () => {
        await startFileStoreHome('owner', home)

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

        // The list the app comes back to may not have the new computer yet: it reloads once when the
        // add ends (a read that can run before the service has the device), and the service sends no
        // device-history change for an add. Opening Devices again loads it afresh, as a person would.
        await openDevices()
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
      [retireThis]
    )
    if (fs.existsSync(home)) throw new Error(`${home} is still there after its retirement`)
  })
})
