import {registerExternalResetter} from '@/util/zustand'
import type {MethodKey} from './types'

// Goes up with every logout reset: every logout, and the old account's side of an account switch.
// A call started before it belongs to an account that is gone, so its reply and any prompts the
// service sends on it are refused (see Session) instead of landing in the next account's stores.
let accountGeneration = 0
export const getAccountGeneration = () => accountGeneration
registerExternalResetter('engine-account-generation', () => {
  accountGeneration++
})

// Calls that change the logged-in account on purpose, so their replies arrive after the reset they
// cause, and calls whose answer belongs to the process rather than an account.
const spansAccountChange: ReadonlySet<MethodKey> = new Set<MethodKey>([
  'keybase.1.account.cancelReset',
  'keybase.1.account.enterResetPipeline',
  'keybase.1.config.getBootstrapStatus',
  'keybase.1.login.accountDelete',
  'keybase.1.login.deprovision',
  'keybase.1.login.getConfiguredAccounts',
  'keybase.1.login.login',
  'keybase.1.login.logout',
  'keybase.1.login.recoverPassphrase',
  'keybase.1.signup.signup',
])
export const survivesAccountChange = (method: MethodKey) => spansAccountChange.has(method)
