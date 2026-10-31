// Classes used to handle RPCs. Ability to inject delays into calls to/from server
import {printRPC, printRPCWaitingSession} from '@/local-debug'
import {requestIdleCallback} from '@/util/idle-callback'
import * as LocalConsole from './local-console'
import {
  RPCTransport,
  type ErrorType,
  type ConnectDisconnectCB,
  type IncomingRPCCallbackType,
  type InvokeType,
  type PayloadType,
} from './rpc-transport'

// Keys (lowercased) whose values are secrets in protocol/avdl params and results: passphrases
// (account/login/signup/secretUi) and the passphrase stream, paper keys and phrases (login,
// paperprovision, loginUi), the kex2 secret (provisionUi), tokens, invite codes and invite-link keys,
// per-team key seeds, and saltpack text (the plaintext, ciphertext and signed message the saltpack
// calls send and return). Booleans such as storeSecret stay visible. transport-shared.test.ts checks
// every secret-shaped field name in rpc-gen against this list.
const secretKeys = new Set([
  'passphrase',
  'oldpassphrase',
  'newpassphrase',
  'pgppassphrase',
  'password',
  'paperkey',
  'paperphrase',
  'phrase',
  'secret',
  'secretkey',
  'token',
  'tokenorname',
  'invitecode',
  'invitelink',
  'bottoken',
  'autoclaimtoken',
  'passphrasestream',
  'seed',
  'perteamkeyseedsverified',
  'plaintext',
  'ciphertext',
  'signedmsg',
])
// `code` is also a numeric status code, so only a string value is a secret (the one-time code of
// verifyPhoneNumber).
const stringSecretKeys = new Set(['code'])
// Methods whose result is itself a secret, returned as a bare string (so there is no key to match).
const secretResultMethods = new Set([
  'generateWebAuthToken',
  'botTokenCreate',
  'teamCreateSeitanTokenV2',
  'getInvitationCode',
  // the signed message
  'saltpackSignString',
  // a wallet account's secret key (the wallet screens' reveal and remove)
  'getWalletAccountSecretKeyLocal',
])
const redactMaxDepth = 12

// Whether a param named `key` holding `value` is a secret, by the key lists above. The e2e harness
// reads route params through this too (tests/e2e/ios-appium/gate/screen-params-lib.ts).
export const isSecretParam = (key: string, value: unknown) =>
  (secretKeys.has(key.toLowerCase()) && typeof value !== 'boolean' && value !== undefined && value !== null) ||
  (stringSecretKeys.has(key.toLowerCase()) && typeof value === 'string')

// A secret a string carries under some other key: the local HTTP server's `token=` query value
// (simpleFSGetGUIFileContext's url, attachment urls), and an invite link's key, everything after
// the `#` of its /i/t/<id>#<key> url (getAnnotatedTeam's invite displayName, a message's text) or
// after the id of the app's keybase://team-invite-link/<id>/<key>.
const tokenQueryRe = /([?&]token=)[^&#\s"']+/gi
const inviteLinkKeyRe = /(\/i\/t\/[^\s#"'/]+#|team-invite-link\/[^\s"'/]+\/)[^\s"']+/gi

// Copy of `value` for logging, with secret-keyed values, `token=` query values and invite-link keys
// replaced. Only plain objects and arrays are walked; anything else (functions, Session, typed
// arrays) is passed through unchanged. An object reached twice is copied (redacted) each time, and
// one that contains itself ends at the depth cut-off, as '<depth>'.
export function redactRpcParams(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') {
    return value.replace(tokenQueryRe, '$1<redacted>').replace(inviteLinkKeyRe, '$1<redacted>')
  }
  if (typeof value !== 'object' || value === null) {
    return value
  }
  if (depth > redactMaxDepth) {
    return '<depth>'
  }
  if (Array.isArray(value)) {
    return value.map(v => redactRpcParams(v, depth + 1))
  }
  const proto = Object.getPrototypeOf(value) as unknown
  if (proto !== Object.prototype && proto !== null) {
    return value
  }
  // a paper key device's name is the first two words of its phrase
  const paperKeyDevice = (value as {type?: unknown}).type === 'backup'
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value)) {
    out[k] =
      isSecretParam(k, v) ||
      (paperKeyDevice && k === 'name' && typeof v === 'string')
        ? '<redacted>'
        : redactRpcParams(v, depth + 1)
  }
  return out
}

// The result of `method` for logging: a secret-returning method's result is replaced whole.
export function redactRpcResult(method: string, data: unknown): unknown {
  if (secretResultMethods.has(method.slice(method.lastIndexOf('.') + 1))) {
    return data === undefined || data === null ? data : '<redacted>'
  }
  return redactRpcParams(data)
}

// Logging for rpcs. `extra` is redacted here, once: as `method`'s result when `result` is set.
function rpcLog(info: {method: string; reason: string; extra?: unknown; type: string; result?: boolean}): void {
  if (!printRPC) {
    return
  }

  if (!printRPCWaitingSession && info.type === 'engineInternal') {
    return
  }

  const prefix = {
    engineInternal: '=',
    engineToServer: '<< OUT',
    serverToEngine: 'IN >>',
  }[info.type] as string

  requestIdleCallback(
    () => {
      const extra = info.result ? redactRpcResult(info.method, info.extra) : redactRpcParams(info.extra)
      const params = [info.reason, info.method, extra].filter(Boolean)
      LocalConsole.green(prefix, info.method, info.reason, ...params)
    },
    {timeout: 1e3}
  )
}

abstract class TransportShared extends RPCTransport {
  // Whether the link to the service is up now
  private _linkUp: boolean

  constructor(
    incomingRPCCallback?: IncomingRPCCallbackType,
    connectCallback?: ConnectDisconnectCB,
    disconnectCallback?: ConnectDisconnectCB,
    linkUp = false
  ) {
    super({
      connectCallback,
      disconnectCallback,
      // logging wrapper only when printRPC; avoids per-message overhead in prod
      incomingRPCCallback:
        incomingRPCCallback && printRPC
          ? payload => {
              const {method, param} = payload
              const extra = param[0]
              rpcLog({extra, method, reason: '[incoming]', type: 'serverToEngine'})
              this.injectInstrumentedResponse(payload)
              incomingRPCCallback(payload)
            }
          : incomingRPCCallback,
    })
    this._linkUp = linkUp
  }

  get isLinkUp() {
    return this._linkUp
  }

  protected override isConnected() {
    return this._linkUp
  }

  protected markLinkDown() {
    this._linkUp = false
    this.onLinkDown()
  }

  protected markLinkUp() {
    this._linkUp = true
    this.onConnected()
  }

  // add logging / multiple call checking
  injectInstrumentedResponse(payload: PayloadType) {
    if (!printRPC || !payload.response) {
      return
    }

    if (payload.response.error) {
      const old = payload.response.error.bind(payload.response)
      let once = false
      payload.response.error = (err?: ErrorType) => {
        const {method} = payload
        if (once) {
          rpcLog({method, reason: 'ignoring multiple result calls', type: 'engineInternal'})
        }
        once = true
        if (printRPC) {
          rpcLog({extra: {payload}, method, reason: '[-calling:session]', type: 'engineToServer'})
        }
        old(err)
      }
    }
    if (payload.response.result) {
      const old = payload.response.result.bind(payload.response)
      let once = false
      payload.response.result = (data: unknown) => {
        const {method} = payload
        if (once) {
          rpcLog({method, reason: 'ignoring multiple result calls', type: 'engineInternal'})
        }
        once = true
        if (printRPC) {
          rpcLog({extra: {payload}, method, reason: '[-calling:session]', type: 'engineToServer'})
        }
        old(data)
      }
    }
  }

  // add logging / multiple call checking
  override invoke(method: string, args: [object], cb: (err: unknown, data: unknown) => void) {
    const extra = args[0]
    if (printRPC) {
      rpcLog({extra, method, reason: '[+calling]', type: 'engineToServer'})
    }
    let once = false
    super.invoke(method, args, (err: unknown, data: unknown) => {
      if (once) {
        rpcLog({method, reason: 'ignoring multiple result calls', type: 'engineInternal'})
        return
      }
      once = true
      if (printRPC) {
        rpcLog({extra: data, method, reason: '[-calling]', result: true, type: 'serverToEngine'})
      }
      cb(err, data)
    })
  }
}

function sharedCreateClient(nativeTransport: TransportShared): {invoke: InvokeType; transport: TransportShared} {
  return {
    invoke: nativeTransport.invoke.bind(nativeTransport) as InvokeType,
    transport: nativeTransport,
  }
}

export {TransportShared, sharedCreateClient, rpcLog}
