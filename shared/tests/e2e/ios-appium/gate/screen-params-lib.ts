// The visible screen as the harness reads it from the app (helpers/lifecycle.ts appSnapshot), with
// its secret route params left in the app: inviteKey (an invite link's key, or the whole link the
// join dialog was given) and every param named like a secret by the dev RPC log's own key list
// (engine/transport-shared.tsx isSecretParam). A crypto output screen's params hold the text it was
// run on and its output (crypto/routes.tsx), which stay in the app too. Framework-free, so jest tests
// it.

// Copies `value` without the keys `isSecret` names (and inviteKey), walking plain objects and
// arrays; past a depth of 12 a value is dropped. Runs inside the app (serialized into the eval body),
// so it refers to nothing outside itself.
export const stripSecretParams = (value: unknown, isSecret: (key: string, v: unknown) => boolean, depth = 0): unknown => {
  if (typeof value !== 'object' || value === null) return value
  if (depth > 12) return undefined
  if (Array.isArray(value)) return value.map(v => stripSecretParams(v, isSecret, depth + 1))
  const proto = Object.getPrototypeOf(value) as unknown
  if (proto !== Object.prototype && proto !== null) return value
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value)) {
    if (k === 'inviteKey' || isSecret(k, v)) continue
    out[k] = stripSecretParams(v, isSecret, depth + 1)
  }
  return out
}

// the phone's crypto output modals (constants/crypto.tsx)
const CRYPTO_OUTPUT_ROUTES = ['decryptOutput', 'encryptOutput', 'signOutput', 'verifyOutput']

// The eval body appSnapshot runs (kbModule is the Metro eval's module lookup).
export const appSnapshotBody = `const stripSecretParams = ${stripSecretParams.toString()}
  const {isSecretParam} = kbModule('engine/transport-shared.tsx')
  const shell = kbModule('stores/shell.tsx').useShellState.getState()
  const config = kbModule('stores/config.tsx').useConfigState.getState()
  const screen = kbModule('constants/router.tsx').getVisibleScreen()
  const cryptoText = !!screen && ${JSON.stringify(CRYPTO_OUTPUT_ROUTES)}.includes(screen.name)
  const isSecret = (k, v) => (cryptoText && (k === 'input' || k === 'output')) || isSecretParam(k, v)
  return {
    httpSrv: config.httpSrv,
    loggedIn: config.loggedIn,
    mobileAppState: shell.mobileAppState,
    screen: screen ? {name: screen.name, params: stripSecretParams(screen.params, isSecret)} : undefined,
  }`
