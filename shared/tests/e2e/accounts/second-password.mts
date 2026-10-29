// yarn test:e2e:accounts:second-password [--check]
//
// Sets KB_SECOND_USER's password to a new random value through the second peer and records it in
// the env file as KB_SECOND_PASSWORD (see second-password-lib.ts). First checks that the main
// service's stored secret for the second account works, and changes nothing when it does not: that
// needs the owner. The password is never printed.
//
// --check only runs that check.
//
// The check switches the main service (and the app on it) to the second account and back, so run
// this only while no flow is running.
import {parseArgs} from 'util'
import {loadE2EEnv, refuseWhileSecondPasswordChangePending} from './env.ts'
import {withSignalsDeferred} from './peer-homes.ts'
import {ensureRunId} from './run-id.ts'
import {checkSecondSecretSurvives, rotateSecondPassword, sayMasked, setSecondPasswordViaPeer} from './second-password-lib.ts'
import {mainWhoami, requireMainIsSmoke, runKeybaseDetached} from '../shared/peer-service.ts'

const say = (s: string) => sayMasked(`[second-password] ${s}`)

const run = async () => {
  const {values} = parseArgs({options: {check: {type: 'boolean'}}})
  const env = loadE2EEnv()
  // before the check switches accounts; rotateSecondPassword refuses again just before it writes
  if (!values.check) refuseWhileSecondPasswordChangePending(env)
  ensureRunId(process.env)
  await requireMainIsSmoke(env)
  const backToSmoke = async () => {
    if ((await mainWhoami().catch(() => '')) !== env.smokeUser) {
      await runKeybaseDetached(['login', '--switch', env.smokeUser], {timeoutMs: 60_000})
    }
    await requireMainIsSmoke(env)
  }
  await withSignalsDeferred(
    async () => {
      try {
        await checkSecondSecretSurvives(env)
      } catch (e) {
        throw new Error(
          `before any change: ${e instanceof Error ? e.message : String(e)}. The main service's stored secret for the second account is already broken; the owner has to sign it in again`,
          {cause: e}
        )
      }
      say('the main service switches to the second account with its stored secret, and the second peer works')
      if (values.check) return
      await rotateSecondPassword(env, async next => setSecondPasswordViaPeer(env, next))
      say('set a new password for the second account through its peer; the stored secret survived it; KB_SECOND_PASSWORD is updated in the env file')
    },
    backToSmoke,
    {say}
  )
  return 0
}

run()
  .then(code => process.exit(code))
  .catch((e: unknown) => {
    console.error(`[second-password] ${e instanceof Error ? e.message : String(e)}`)
    process.exit(1)
  })
