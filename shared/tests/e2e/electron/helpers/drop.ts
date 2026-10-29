// Files from disk dropped or pasted into the app as a user would. A hidden file input is given the
// files by path with CDP's DOM.setFileInputFiles, so the page holds disk-backed Files and the
// preload's getPathForFile returns their real paths; the files then ride a DataTransfer in the drag
// or paste events. (Playwright's setInputFiles over connectOverCDP sends the bytes instead, as to a
// remote browser, and those Files have no path.)
import type {Locator, Page} from '@playwright/test'
import {connectMainProcess} from './main-process'

const INPUT_ID = 'kb-e2e-file-source'
const ACCEPT_MS = 10_000

type DomLike = {
  document: {
    createElement: (t: string) => ElLike
    getElementById: (id: string) => (ElLike & {files: unknown}) | null
    elementFromPoint: (x: number, y: number) => ElLike | null
    body: {appendChild: (e: ElLike) => void}
  }
  DataTransfer: new () => {items: {add: (f: unknown) => void}}
  DragEvent: new (type: string, init: object) => unknown
  ClipboardEvent: new (type: string, init: object) => unknown
  requestAnimationFrame: (f: () => void) => void
}
type ElLike = {id: string; type: string; multiple: boolean; style: {display: string}; remove: () => void; dispatchEvent: (e: unknown) => boolean}

// Adds the hidden input, loads `paths` into it, runs `withThem`, and removes it.
const withFiles = async (page: Page, paths: ReadonlyArray<string>, withThem: () => Promise<void>) => {
  if (!paths.length) throw new Error('no files to drop')
  await page.evaluate(id => {
    const g = globalThis as unknown as DomLike
    const input = g.document.createElement('input')
    input.id = id
    input.type = 'file'
    input.multiple = true
    input.style.display = 'none'
    g.document.body.appendChild(input)
  }, INPUT_ID)
  try {
    const cdp = await page.context().newCDPSession(page)
    try {
      const {result} = await cdp.send('Runtime.evaluate', {expression: `document.getElementById(${JSON.stringify(INPUT_ID)})`})
      if (!result.objectId) throw new Error('the file input was not added to the page')
      await cdp.send('DOM.setFileInputFiles', {files: [...paths], objectId: result.objectId})
    } finally {
      await cdp.detach().catch(() => {})
    }
    await withThem()
  } finally {
    await page.evaluate(id => (globalThis as unknown as DomLike).document.getElementById(id)?.remove(), INPUT_ID)
  }
}

const centerOf = async (target: Locator) => {
  const box = await target.boundingBox({timeout: 5_000})
  if (!box) throw new Error('the drop target is not on screen')
  return {x: box.x + box.width / 2, y: box.y + box.height / 2}
}

// Drags `paths` onto `target` and drops them: dragenter and dragover on what is under the target's
// center, then, once the app has drawn its response (a drop overlay replaces what was there), drop
// on what is under that point then, as a real drop would. With `accepts` (what the app draws once it
// takes the drop, such as a drop overlay's prompt), dragover keeps firing, as it does while a person
// holds files over the target, until that shows: a target that refuses drops for a while (busy with
// a run) draws nothing for the dragovers before then, and a drop then would be lost.
export const dropFiles = async (
  page: Page,
  target: Locator,
  paths: ReadonlyArray<string>,
  accepts?: Locator
): Promise<void> => {
  const at = await centerOf(target)
  await withFiles(page, paths, async () => {
    const fire = async (types: ReadonlyArray<string>) => {
      const hit = await page.evaluate(
        ([id, x, y, ts]) => {
          const g = globalThis as unknown as DomLike
          const input = g.document.getElementById(id) as unknown as {files: ArrayLike<unknown>}
          const dt = new g.DataTransfer()
          for (const f of Array.from(input.files)) dt.items.add(f)
          const el = g.document.elementFromPoint(x, y)
          if (!el) return false
          for (const type of ts) el.dispatchEvent(new g.DragEvent(type, {bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: dt}))
          return true
        },
        [INPUT_ID, at.x, at.y, types] as const
      )
      if (!hit) throw new Error(`nothing under the drop target's center (${at.x}, ${at.y})`)
    }
    const nextFrames = async () =>
      page.evaluate(async () => {
        const g = globalThis as unknown as DomLike
        await new Promise<void>(resolve => g.requestAnimationFrame(() => g.requestAnimationFrame(resolve)))
      })
    await fire(['dragenter', 'dragover'])
    await nextFrames()
    if (accepts) {
      const deadline = Date.now() + ACCEPT_MS
      while (!(await accepts.isVisible())) {
        if (Date.now() > deadline) throw new Error(`the drop target never showed it takes the drop within ${ACCEPT_MS}ms`)
        await fire(['dragover'])
        await nextFrames()
      }
    }
    await fire(['dragover', 'drop'])
  })
}

// Pastes `paths` into `target` as a paste event carrying them. The desktop app takes a pasted
// image from the clipboard in its main process, so that read is stubbed to return the first path
// (restored after the test, see fixtures.ts).
export const pasteFiles = async (page: Page, target: Locator, paths: ReadonlyArray<string>): Promise<void> => {
  const [first] = paths
  if (first) await (await connectMainProcess()).stubClipboardImage(first)
  await withFiles(page, paths, async () => {
    await target.evaluate((el, id) => {
      const g = globalThis as unknown as DomLike
      const input = g.document.getElementById(id) as unknown as {files: ArrayLike<unknown>}
      const dt = new g.DataTransfer()
      for (const f of Array.from(input.files)) dt.items.add(f)
      ;(el as unknown as ElLike).dispatchEvent(new g.ClipboardEvent('paste', {bubbles: true, cancelable: true, clipboardData: dt}))
    }, INPUT_ID)
  })
}
