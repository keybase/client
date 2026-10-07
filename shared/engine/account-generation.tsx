import {survivesAccountChangeMethods} from '@/constants/rpc'
import logger from '@/logger'
import type {MethodKey} from './types'

// A call made during an account switch, waiting for it to end
type Held = {
  method: MethodKey
  // Runs once: with true if the account changed while the call was held, so it must not go out
  resume: (accountChanged: boolean) => void
  since: number
  warn: ReturnType<typeof setTimeout>
}

// Goes up when the session logs out: every logout, and the old account's side of an account switch.
// A call started before it belongs to an account that is gone, so its reply and any prompts the
// service sends on it are refused (see Session) instead of landing in the next account's stores.
let accountGeneration = 0
let switching = false
let loggedIn = false
// Oldest first
const held: Array<Held> = []
const warnAfterMs = 10_000

const devLog = (...args: Array<unknown>) => {
  if (__DEV__) {
    logger.info('[engine-gate]', ...args)
  }
}

const unhold = (h: Held) => {
  const i = held.indexOf(h)
  if (i === -1) {
    return false
  }
  held.splice(i, 1)
  clearTimeout(h.warn)
  return true
}

export const getAccountGeneration = () => accountGeneration
// Called before anything reacts to the logout, so calls the logout itself starts are the new
// generation's. A call held for the old account will never go out.
export const startNewAccountGeneration = () => {
  accountGeneration++
  for (const h of held.splice(0)) {
    clearTimeout(h.warn)
    devLog('reject', h.method, 'the account changed while it was held')
    h.resume(true)
  }
}

// Calls that change the logged-in account on purpose, so their replies arrive after the logout
// they cause, and calls whose answer belongs to the process or the connection rather than an account
export const survivesAccountChange = (method: MethodKey) => survivesAccountChangeMethods.has(method)

// The config store says when an account switch starts and ends. At the end the held calls go out in
// the order they were made: all are the current account's, since a logout rejects the others at once.
export const setAccountSwitching = (on: boolean) => {
  if (on === switching) {
    return
  }
  switching = on
  if (on) {
    return
  }
  for (const h of held.splice(0)) {
    clearTimeout(h.warn)
    devLog('release', h.method, `held ${Date.now() - h.since}ms`)
    h.resume(false)
  }
}

// The config store says whether the app is logged in
export const setAccountLoggedIn = (on: boolean) => {
  loggedIn = on
}

// A call of the current account the service failed as login-required may be made again only while
// the app is logged in and not switching: right after a login the service fails calls whose session it
// is still setting up, and a retry then gets its answer. A call that outlives the account is not tied
// to its session.
export const mayRetryLoginRequired = (method: MethodKey) =>
  loggedIn && !switching && !survivesAccountChange(method)

// Holds a call made while the account is switching until the switch ends, unless it survives an
// account change: it would reach whichever account the service has at that instant. Returns
// undefined when the call goes out now, else a function that drops it without resuming.
export const holdDuringSwitch = (method: MethodKey, resume: Held['resume']): undefined | (() => void) => {
  if (!switching || survivesAccountChange(method)) {
    return undefined
  }
  // No timeout: the switch always ends, and a call failed here would only be made again
  const h: Held = {
    method,
    resume,
    since: Date.now(),
    warn: setTimeout(() => {
      logger.warn(`Engine: ${method} held ${warnAfterMs / 1000}s during an account switch`)
    }, warnAfterMs),
  }
  held.push(h)
  devLog('park', method)
  return () => {
    if (unhold(h)) {
      devLog('drop', method)
    }
  }
}
