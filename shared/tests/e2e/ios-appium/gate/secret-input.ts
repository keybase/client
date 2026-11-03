// Putting a secret (a password, a paper key) into a field of the app, or a provisioning phrase into
// its code page, from inside its JS runtime, over Metro's inspector: no Appium command carries the
// value, so it is in no WebDriver request, Appium log or wdio report. The target is checked first in
// an eval that holds no secret; the secret then travels only in one short Runtime.evaluate frame
// that calls what the check left. No eval's error is passed on (one could echo the body), and every
// message here is built from field ids and lengths. A flow that types a secret runs with retries 0
// and takes no step screenshot while the field holds it.
import {evalInPage, INSPECTOR_CLOSED, inspectorPageFor} from '../../shared/metro-eval.ts'
import {BUNDLE_ID, deviceName} from '../helpers/lifecycle'
import {holdRunSecret} from './run-secrets'
import {requireCurrentAttempt} from './attempt.ts'
import {
  type FieldRead,
  fieldProblem,
  focusEvalBody,
  lengthEvalBody,
  prepareEvalBody,
  provisionPrepareEvalBody,
  provisionProblem,
  type ProvisionSubmit,
  secretEvalBody,
  secureDots,
  textEvalBody,
} from './secret-input-lib.ts'

const SETTLE_MS = 5_000

// metro-eval's own transport failures name no part of the body
const TRANSPORT_ERRORS = new Set(['inspector evaluate timed out', 'inspector connection failed', INSPECTOR_CLOSED])

const evalWithheld = async <R,>(body: string, what: string): Promise<R | undefined> => {
  // looked up outside the try: its errors name no part of the body
  const page = await inspectorPageFor(deviceName(), BUNDLE_ID)
  // after the lookup's wait, just before the send, and outside the try: a body that is over is refused
  // with its title alone
  requireCurrentAttempt()
  try {
    return await evalInPage<R>(page, body)
  } catch (e) {
    const m = e instanceof Error ? e.message : ''
    // no cause: the app's error description can quote the body, secret included
    // eslint-disable-next-line preserve-caught-error
    throw new Error(`${what} failed: ${TRANSPORT_ERRORS.has(m) ? m : "the app's error is withheld"}`)
  }
}

const evalField = async (fieldTestID: string, body: string, what: string) => evalWithheld<FieldRead>(body, `${what} ${fieldTestID}`)

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

// Waits until the native field is a secure one showing `length` dots, as XCUITest reads it. One
// element query carries the type, id and dots, and its answer is an element id or nothing: no
// Appium response ever holds the field's value, even if it stopped being secure.
const waitForDots = async (fieldTestID: string, length: number) => {
  const secure = browser.$(
    `-ios predicate string:type == "XCUIElementTypeSecureTextField" AND name == ${JSON.stringify(fieldTestID)} AND value == "${secureDots(length)}"`
  )
  const deadline = Date.now() + SETTLE_MS
  while (!(await secure.isExisting())) {
    requireCurrentAttempt()
    if (Date.now() > deadline) throw new Error(`the field ${fieldTestID} is not a secure field showing ${length} dots`)
    await new Promise(resolve => setTimeout(resolve, 100))
  }
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

// Puts `text` into the focused field fieldTestID through the same path as a secret (the field's own
// onChange, no key presses), for a field that holds no secret and that XCUITest cannot reach.
export const setFieldText = async (fieldTestID: string, text: string): Promise<void> => setField(fieldTestID, text, 'setting the field')

// The focused field's text, when it is the field fieldTestID and holds no secret (textEvalBody).
export const focusedFieldText = async (fieldTestID: string): Promise<string> => {
  const r = await evalField(fieldTestID, textEvalBody(fieldTestID), 'reading the field')
  if (r?.state !== 'read' || r.text === undefined) throw new Error(fieldProblem(fieldTestID, r))
  return r.text
}

// Hands a provisioning phrase to the code page the app has open, through submitProvisionTextCode
// (what its QR scanner calls with the code it read: the simulator has no camera). The phrase travels
// only in the second eval, as a secret does above. The app's answer comes later: its code page
// closes once the provisioning ends. The phrase is held for the worker's end-of-run scan.
export const submitProvisionPhrase = async (phrase: string): Promise<void> => {
  holdRunSecret(phrase)
  const ready = await evalWithheld<ProvisionSubmit>(provisionPrepareEvalBody(), 'checking the code page before submitting the phrase')
  if (ready?.state !== 'ready') throw new Error(provisionProblem(ready))
  const r = await evalWithheld<ProvisionSubmit>(secretEvalBody(phrase), 'submitting the phrase')
  if (r?.state !== 'submitted') throw new Error(provisionProblem(r))
}
