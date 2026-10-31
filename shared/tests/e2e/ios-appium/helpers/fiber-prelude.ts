// Eval-body helpers for reading the app's React tree over Metro, put at the top of a body:
// e2eRootFiber(): the current root fiber of the app's renderer.
// e2eHostOf(fiber): the first native host view down a fiber's first-child chain (its stateNode.node
// is what nativeFabricUIManager measures), or undefined.
export const fiberPrelude = `
  const e2eRootFiber = () => {
    const hook = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__
    if (!hook || typeof hook.getFiberRoots !== 'function') throw new Error('e2e: no __REACT_DEVTOOLS_GLOBAL_HOOK__.getFiberRoots')
    let root
    for (const r of hook.getFiberRoots(1)) root = r
    if (!root || !root.current) throw new Error('e2e: no React root fiber')
    return root.current
  }
  const e2eHostOf = c => {
    for (let f = c && c.child; f; f = f.child) if (f.tag === 5 && f.stateNode && f.stateNode.node) return f
    return undefined
  }
`
