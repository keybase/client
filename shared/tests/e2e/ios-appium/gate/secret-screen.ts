// Whether a secret is on the app's screen now (an invite link in a field, a paper key's words, the
// code page's QR): a flow marks it just before the secret shows and clears it once the screen no
// longer shows it. While one is marked, step() refuses and a failed attempt's capture takes no
// screenshot (finish.ts), so a test that timed out mid-way, before its cleanup closed the screen,
// still leaves no picture of it. Each mark is cleared only by its own flow, by the label it set.
// A mark that is never cleared (its screen would not close) makes every later step() in this worker
// refuse and withholds every later failure screenshot: deliberate, as it fails safe, never showing
// a screen that may still hold the secret.
// Framework-free, so jest tests it.

const shown = new Set<string>()

export const SCREENSHOT_WITHHELD = 'screenshot withheld: a secret was on screen'

// `what` names the screen, never the secret.
export const markSecretOnScreen = (what: string) => {
  shown.add(what)
}

export const clearSecretOnScreen = (what: string) => {
  shown.delete(what)
}

// The first secret marked as on screen, or undefined.
export const secretOnScreen = (): string | undefined => shown.values().next().value

export const requireNoSecretOnScreen = () => {
  const what = secretOnScreen()
  if (what !== undefined) throw new Error(`no step while a secret is on screen (${what})`)
}

// What a failed attempt's capture attaches in place of its screenshot: a screenshot, a note that it
// was withheld, or nothing for an attempt that did not fail.
export const failureCapture = (failed: boolean): 'none' | 'screenshot' | 'withheld' =>
  !failed ? 'none' : secretOnScreen() === undefined ? 'screenshot' : 'withheld'
