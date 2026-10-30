// A computer the CLI provisions for a flow that revokes it in an app: a fresh peer home
// (homes/cli-<runid>, the file secret store) signs in as the smoke account with the env file's paper
// key for it (KB_OWNER_PAPERKEY, only ever on the CLI's stdin) as e2e-<runid>-cli. Its service is shut
// down once it is signed in, so the device never acts on its own revoke. A run that dies leaves the
// device and its home to the sweeper (sweep-lib provDeviceLabels). Keybase never lets a device name
// be used twice, so this runs once per run id.
// Relative imports only: plain node loads this too.
import * as fs from 'fs'
import {provisionHomeFor, type E2EEnv} from '../accounts/env.ts'
import {checkRetirablePeerHome, readPeerConfig, removeRetiredPeerHome, retirePeerHome, stopPeerHomeService} from '../accounts/peer-homes.ts'
import {cliProvDeviceLabel} from '../accounts/sweep-lib.ts'
import {withCleanup} from '../electron/helpers/cleanup.ts'
import {activeDevices, deviceHistory, provDeviceName, revokeLeftoverFromPhoneFlow} from './devices.ts'
import {peerCli, peerUsesFileSecretStore, runKeybase, setPeerFileSecretStore, waitForPeerService} from './peer-service.ts'

export type CliDevice = {deviceID: string; name: string}

const signedInUsers = (home: string) => (fs.existsSync(home) ? Object.keys(readPeerConfig(home).users ?? {}) : [])

export const provisionCliDevice = async (env: E2EEnv, runId: string): Promise<CliDevice> => {
  const home = provisionHomeFor(runId, cliProvDeviceLabel)
  const name = provDeviceName(runId, cliProvDeviceLabel)
  const keep = env.peers.owner.home
  if (!env.peers.owner.paperKey) throw new Error('KB_OWNER_PAPERKEY is not set: the CLI device signs in with it')
  if (fs.existsSync(home)) throw new Error(`${home} already exists: this run id already provisioned its CLI device (one per run id)`)

  // The file secret store before the home's service ever starts: peer homes share the Keychain by
  // username, so a home on it would overwrite the main service's stored secret.
  fs.mkdirSync(home, {mode: 0o700, recursive: true})
  setPeerFileSecretStore(home)
  if (!peerUsesFileSecretStore(home)) throw new Error(`${home} does not keep its secret in a file; refusing to start it`)
  await withCleanup(
    async () => {
      await waitForPeerService('owner', home)
      if (!peerUsesFileSecretStore(home)) throw new Error(`${home}'s running service dropped the file secret store; refusing to log in`)
      // runKeybase redacts a run of words like the paper key out of any error it throws
      await runKeybase(['--home', home, 'login', '--devicename', name, env.smokeUser], {
        input: `${env.peers.owner.paperKey}\n`,
        timeoutMs: 180_000,
      })
      const who = await peerCli(home)(['whoami'], 15_000)
      if (who !== env.smokeUser) throw new Error(`${home} is signed in as ${who || 'nobody'} after its login, not the smoke account`)
    },
    [
      async () => {
        checkRetirablePeerHome(home, keep)
        await stopPeerHomeService(home)
        // a home that never signed in has no device for the sweeper (or retireCliDevice) to find
        if (!signedInUsers(home).length) await removeRetiredPeerHome(home, keep, env.smokeUser, () => {})
      },
    ]
  )
  const deviceID = readPeerConfig(home).users?.[env.smokeUser]?.device ?? ''
  const listed = (await activeDevices()).filter(d => d.deviceID === deviceID)
  if (!deviceID || listed.length !== 1 || listed[0]?.name !== name || listed[0].type !== 'desktop') {
    throw new Error(`the service lists no active computer ${name} with the id ${home} holds`)
  }
  return {deviceID, name}
}

// Retires run `runId`'s CLI device from its home, whatever provisionCliDevice got to: the device id
// comes from the home's own config (retirePeerHome reads it after shutting the service down), so a
// login that succeeded before a later check threw is still found. A device the app did not revoke is
// revoked here through the main service, guarded as a phone flow's revoke is; then the home goes.
export const retireCliDevice = async (env: E2EEnv, runId: string, phoneDeviceID: string) => {
  const home = provisionHomeFor(runId, cliProvDeviceLabel)
  const name = provDeviceName(runId, cliProvDeviceLabel)
  const keep = env.peers.owner.home
  if (!fs.existsSync(home)) return
  await retirePeerHome(
    {newHome: keep, oldHome: home, role: 'owner', user: env.smokeUser},
    {
      remove: async h => removeRetiredPeerHome(h, keep, env.smokeUser, () => {}),
      revoke: async deviceID => {
        await revokeLeftoverFromPhoneFlow(env, {deviceID, name}, phoneDeviceID)
        if (!(await deviceHistory()).find(d => d.deviceID === deviceID)?.revoked) {
          throw new Error(`refusing to retire ${home}: the service does not list ${name} as revoked`)
        }
      },
      say: () => {},
      stop: stopPeerHomeService,
    }
  )
}
