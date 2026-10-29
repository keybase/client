// Typing a secret (a password, a paper key, a provisioning phrase) into one of the app's windows
// with no Playwright action or assertion while a field holds it: an action's arguments go into step
// titles, the report and any trace, and a failing action or assertion snapshots the page, field
// values included, into the failure's artifacts. The main process types (webContents.insertText),
// field lengths are read with page.evaluate (never the text), and a field is emptied with real
// editing commands so the app's own state follows.
//
// Relative imports only: the setup command (node, no path aliases) loads this too.
import type {Page} from '@playwright/test'
import {connectMainProcess} from './main-process.ts'

// A window of the app, by a part of its URL: 'main.html', or 'component=unlock-folders'.
export type SecretWindow = string

// Runs `body` with `w` bound to the window's webContents; false when no such window is open.
export const inWindow = (win: SecretWindow, body: string) => `(() => {
  const w = Electron.webContents.getAllWebContents().find(c => c.getURL().includes(${JSON.stringify(win)}))
  if (!w) return false
  ${body}
  return true
})()`

type Dom = {document: {querySelectorAll: (q: string) => ArrayLike<{value?: string}>}}

// How much each field matching `selector` holds (lengths only), or undefined when the page cannot
// be read, which no caller may take for empty.
export const fieldLengths = async (page: Page, selector: string): Promise<Array<number> | undefined> =>
  page
    .evaluate(sel => Array.from((globalThis as unknown as Dom).document.querySelectorAll(sel), i => (i.value ?? '').length), selector)
    .catch(() => undefined)

const sleep = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Inserts `secret` at the focused field of `win`, only when that field matches `selector` (a secret
// typed where focus moved to would sit in another field as plain text), and waits until a field
// matching `selector` holds all of it. Returns why it did not, naming no value.
export const insertSecret = async (page: Page, win: SecretWindow, selector: string, secret: string): Promise<string | undefined> => {
  const mp = await connectMainProcess()
  const focused = JSON.stringify(`document.activeElement?.matches(${JSON.stringify(selector)}) === true`)
  // the secret goes last: an eval that times out names the expression's first 80 characters
  const typed = await mp.eval<'typed' | 'no window' | 'not focused'>(`(async text => {
  const w = Electron.webContents.getAllWebContents().find(c => c.getURL().includes(${JSON.stringify(win)}))
  if (!w) return 'no window'
  if ((await w.executeJavaScript(${focused})) !== true) return 'not focused'
  w.insertText(text)
  return 'typed'
})(${JSON.stringify(secret)})`)
  if (typed === 'no window') return `the app's ${win} window was not found`
  if (typed === 'not focused') return `the focused element in the app's ${win} window is not the secret field`
  const deadline = Date.now() + 5_000
  while (Date.now() < deadline) {
    if ((await fieldLengths(page, selector))?.includes(secret.length)) return undefined
    await sleep(50)
  }
  return 'the field did not take the secret'
}

export const pressReturn = async (win: SecretWindow) => {
  const mp = await connectMainProcess()
  await mp.eval(
    inWindow(
      win,
      `w.sendInputEvent({type: 'keyDown', keyCode: 'Return'})
  w.sendInputEvent({type: 'char', keyCode: 'Return'})
  w.sendInputEvent({type: 'keyUp', keyCode: 'Return'})`
    )
  )
}

// Empties the focused field of `win` (select all, delete) and reads every field matching `selector`
// back: each must be ''. Throws, naming no value, if one still holds anything or cannot be read.
export const emptyFocusedField = async (page: Page, win: SecretWindow, selector: string) => {
  const mp = await connectMainProcess()
  await mp.eval(inWindow(win, 'w.selectAll(); w.delete()'))
  const empty = async () => (await fieldLengths(page, selector))?.every(n => n === 0) ?? false
  const deadline = Date.now() + 5_000
  while (!(await empty()) && Date.now() < deadline) await sleep(100)
  if (!(await empty())) throw new Error('the secret field could not be emptied')
}

// A failure message with `secret` cut out of it.
export const withoutSecret = (e: unknown, secret: string) => (e instanceof Error ? e.message : String(e)).split(secret).join('<secret>')
