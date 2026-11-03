// The main process's side of the remote windows, at the preload edge (KB2.functions): which
// windows the renderer asked main to open and close, and the props it sent them. Import this
// before the code under test: the window hooks read KB2.functions when they load.
type Functions = Record<string, unknown>

const functions = (globalThis._fromPreload as {functions: Functions}).functions

type WindowKey = {windowComponent?: string; windowParam?: string}
const keyOf = (w: WindowKey) => `${w.windowComponent ?? ''}:${w.windowParam ?? ''}`

const open = new Set<string>()
const sentProps: Array<{propsStr: string; windowComponent: string; windowParam: string}> = []

functions['makeRenderer'] = (w: WindowKey) => {
  open.add(keyOf(w))
}
functions['closeRenderer'] = (w: WindowKey) => {
  open.delete(keyOf(w))
}
functions['rendererNewProps'] = (p: {propsStr: string; windowComponent: string; windowParam: string}) => {
  sentProps.push(p)
}

// Whether main has a window of this component up
export const isWindowOpen = (windowComponent: string) =>
  [...open].some(k => k.startsWith(`${windowComponent}:`))

if (typeof afterEach === 'function') {
  afterEach(() => {
    open.clear()
    sentProps.length = 0
  })
}
