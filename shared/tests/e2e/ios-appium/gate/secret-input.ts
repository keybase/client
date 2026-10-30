// Putting a secret (a password, a paper key) into a field of the app from inside its JS runtime, over
// Metro's inspector: no Appium command carries the value, so it is in no WebDriver request, Appium
// log or wdio report. The secret travels only in the one Runtime.evaluate frame to the app; its
// eval's errors are never passed on (one could echo the body), and every message here is built from
// field ids and lengths. A flow that types a secret runs with retries 0 and takes no step screenshot
// while the field holds it.
import {evalInPage, inspectorPageFor} from '../../shared/metro-eval.ts'
import {emptyEvalBody, type FieldRead, fieldProblem, focusEvalBody, lengthEvalBody, secretEvalBody} from './secret-input-lib.ts'

const DEVICE = process.env['KB_IOS_DEVICE'] ?? 'iPhoneTest'
const APP_ID = 'keybase.ios'
const SETTLE_MS = 5_000

// metro-eval's own transport failures name no part of the body
const TRANSPORT_ERRORS = new Set(['inspector evaluate timed out', 'inspector connection failed'])

const evalField = async (fieldTestID: string, body: string, what: string): Promise<FieldRead | undefined> => {
  const page = await inspectorPageFor(DEVICE, APP_ID)
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

// Puts `secret` into the focused field, only when it is the field with fieldTestID (focus that moved
// elsewhere would put the secret in plain sight), and waits until the field holds all of it.
export const submitSecret = async (fieldTestID: string, secret: string): Promise<void> => {
  const r = await evalField(fieldTestID, secretEvalBody(fieldTestID, secret), 'setting the secret field')
  if (r?.state !== 'set') throw new Error(fieldProblem(fieldTestID, r))
  await waitForLength(fieldTestID, secret.length)
}

// Empties the focused field fieldTestID through the same path and checks it reads 0.
export const emptySecretField = async (fieldTestID: string): Promise<void> => {
  const r = await evalField(fieldTestID, emptyEvalBody(fieldTestID), 'emptying the secret field')
  if (r?.state !== 'set') throw new Error(fieldProblem(fieldTestID, r))
  await waitForLength(fieldTestID, 0)
}

// The focused field's length, for a test's assertion.
export const fieldLength = async (fieldTestID: string): Promise<number> => {
  const r = await evalField(fieldTestID, lengthEvalBody(fieldTestID), 'reading the field')
  if (r?.state !== 'read') throw new Error(fieldProblem(fieldTestID, r))
  return r.length
}
