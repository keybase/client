// Putting a secret (a password, a paper key) into a field of the app from inside its JS runtime, over
// Metro's inspector: no Appium command carries the value, so it is in no WebDriver request, Appium
// log or wdio report. The field is checked first in an eval that holds no secret; the secret then
// travels only in one short Runtime.evaluate frame that calls what the check left. No eval's error
// is passed on (one could echo the body), and every message here is built from field ids and
// lengths. A flow that types a secret runs with retries 0 and takes no step screenshot while the
// field holds it.
import {evalInPage, INSPECTOR_CLOSED, inspectorPageFor} from '../../shared/metro-eval.ts'
import {el} from '../helpers/elements'
import {BUNDLE_ID, deviceName} from '../helpers/lifecycle'
import {type FieldRead, fieldProblem, focusEvalBody, lengthEvalBody, prepareEvalBody, secretEvalBody, secureDots} from './secret-input-lib.ts'

const SETTLE_MS = 5_000

// metro-eval's own transport failures name no part of the body
const TRANSPORT_ERRORS = new Set(['inspector evaluate timed out', 'inspector connection failed', INSPECTOR_CLOSED])

const evalField = async (fieldTestID: string, body: string, what: string): Promise<FieldRead | undefined> => {
  // looked up outside the try: its errors name no part of the body
  const page = await inspectorPageFor(deviceName(), BUNDLE_ID)
  try {
    return await evalInPage<FieldRead>(page, body)
  } catch (e) {
    const m = e instanceof Error ? e.message : ''
    // no cause: the app's error description can quote the body, secret included
    // eslint-disable-next-line preserve-caught-error
    throw new Error(`${what} ${fieldTestID} failed: ${TRANSPORT_ERRORS.has(m) ? m : "the app's error is withheld"}`)
  }
}

// Waits until the focused field fieldTestID holds `length` characters.
const waitForLength = async (fieldTestID: string, length: number) => {
  const deadline = Date.now() + SETTLE_MS
  let r: FieldRead | undefined
  for (;;) {
    r = await evalField(fieldTestID, lengthEvalBody(fieldTestID), 'reading the field')
    if (r?.state !== 'read') throw new Error(fieldProblem(fieldTestID, r))
    if (r.length === length) return
    if (Date.now() > deadline) break
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`the field ${fieldTestID} holds ${r.length} characters, not ${length}`)
}

// Waits until the native secure field shows `length` dots, as XCUITest reads it. Only a field that
// is still a secure one is read: any other would answer with its text.
const waitForDots = async (fieldTestID: string, length: number) => {
  const field = el(fieldTestID)
  const deadline = Date.now() + SETTLE_MS
  let shown: number
  for (;;) {
    const type = await field.getAttribute('type')
    if (type !== 'XCUIElementTypeSecureTextField') throw new Error(`the field ${fieldTestID} is a ${type}, not a secure text field; not reading it`)
    const value = (await field.getAttribute('value')) ?? ''
    if (value === secureDots(length)) return
    shown = /^•+$/.test(value) ? value.length : 0
    if (Date.now() > deadline) break
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`the field ${fieldTestID} shows ${shown} dots, not ${length}`)
}

// Focuses the field with fieldTestID and waits until it is the focused input.
export const focusSecretField = async (fieldTestID: string): Promise<void> => {
  const r = await evalField(fieldTestID, focusEvalBody(fieldTestID), 'focusing the field')
  if (r?.state !== 'focused') throw new Error(fieldProblem(fieldTestID, r))
  const deadline = Date.now() + SETTLE_MS
  for (;;) {
    const now = await evalField(fieldTestID, lengthEvalBody(fieldTestID), 'reading the field')
    if (now?.state === 'read') return
    if (Date.now() > deadline) throw new Error(fieldProblem(fieldTestID, now))
    await new Promise(resolve => setTimeout(resolve, 100))
  }
}

// Puts `text` into the focused field, only when it is the field with fieldTestID (focus that moved
// elsewhere would put a secret in plain sight), whether or not the field takes a value prop, and
// waits until the field holds all of it: the length TextInput has and, for a secure field, the dots
// the native field shows.
const setField = async (fieldTestID: string, text: string, what: string) => {
  const ready = await evalField(fieldTestID, prepareEvalBody(fieldTestID), `checking the field before ${what}`)
  if (ready?.state !== 'ready') throw new Error(fieldProblem(fieldTestID, ready))
  const r = await evalField(fieldTestID, secretEvalBody(text), what)
  if (r?.state !== 'set') throw new Error(fieldProblem(fieldTestID, r))
  await waitForLength(fieldTestID, text.length)
  if (r.secure && text.length) await waitForDots(fieldTestID, text.length)
}

export const submitSecret = async (fieldTestID: string, secret: string): Promise<void> => setField(fieldTestID, secret, 'setting the secret field')

// Empties the focused field fieldTestID through the same path and checks it reads 0.
export const emptySecretField = async (fieldTestID: string): Promise<void> => setField(fieldTestID, '', 'emptying the secret field')

// The focused field's length, for a test's assertion.
export const fieldLength = async (fieldTestID: string): Promise<number> => {
  const r = await evalField(fieldTestID, lengthEvalBody(fieldTestID), 'reading the field')
  if (r?.state !== 'read') throw new Error(fieldProblem(fieldTestID, r))
  return r.length
}
