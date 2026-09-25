import type {MethodKey} from './types'

// Goes up when the session logs out: every logout, and the old account's side of an account switch.
// A call started before it belongs to an account that is gone, so its reply and any prompts the
// service sends on it are refused (see Session) instead of landing in the next account's stores.
let accountGeneration = 0
export const getAccountGeneration = () => accountGeneration
// Called before anything reacts to the logout, so calls the logout itself starts are the new
// generation's.
export const startNewAccountGeneration = () => {
  accountGeneration++
}

// Calls that change the logged-in account on purpose, so their replies arrive after the logout
// they cause, and calls whose answer belongs to the process rather than an account.
const spansAccountChange: ReadonlySet<MethodKey> = new Set<MethodKey>([
  'keybase.1.account.cancelReset',
  'keybase.1.account.enterResetPipeline',
  'keybase.1.config.appendGUILogs',
  'keybase.1.config.getBootstrapStatus',
  'keybase.1.config.guiGetValue',
  'keybase.1.config.guiSetValue',
  'keybase.1.config.helloIAm',
  'keybase.1.config.logSend',
  'keybase.1.config.waitForClient',
  'keybase.1.login.accountDelete',
  'keybase.1.login.deprovision',
  'keybase.1.login.getConfiguredAccounts',
  'keybase.1.login.login',
  'keybase.1.login.logout',
  'keybase.1.login.recoverPassphrase',
  'keybase.1.signup.signup',
])
// Registering UIs and notification channels is per connection, not per account.
const processWidePrefixes = ['keybase.1.delegateUiCtl.', 'keybase.1.notifyCtl.']
export const survivesAccountChange = (method: MethodKey) =>
  spansAccountChange.has(method) || processWidePrefixes.some(p => method.startsWith(p))
