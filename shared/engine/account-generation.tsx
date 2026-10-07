import {survivesAccountChangeMethods} from '@/constants/rpc'
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
// they cause, and calls whose answer belongs to the process or the connection rather than an account
export const survivesAccountChange = (method: MethodKey) => survivesAccountChangeMethods.has(method)
