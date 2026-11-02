// Eval-body helpers for reading the app's React tree over Metro, put at the top of a body:
// e2eRootFiber(): the current root fiber of the app's renderer.
// e2eHostOf(fiber): the first native host view down a fiber's first-child chain (its stateNode.node
// is what nativeFabricUIManager measures), or undefined.
// e2eMessageFibers(ordinal): the topmost fibers of the thread's message at `ordinal`: those carrying
// it under none that does.
// e2eMeasure(key, hosts): measures each host view in its window, and once all have answered puts
// their frames, in `hosts`' order, at globalThis[key] (cleared first), for the TS side's measured().
// A measure still pending from an earlier call with the same key lands nowhere.
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
  const e2eMessageFibers = ordinal => {
    const want = String(ordinal)
    const rows = []
    const stack = [e2eRootFiber()]
    while (stack.length) {
      const f = stack.pop()
      const p = f.memoizedProps
      if (f.sibling) stack.push(f.sibling)
      if (p && p.ordinal !== undefined && String(p.ordinal) === want) rows.push(f)
      else if (f.child) stack.push(f.child)
    }
    return rows
  }
  const e2eMeasure = (key, hosts) => {
    const g = globalThis
    const call = {}
    g[key] = undefined
    g[key + 'Call'] = call
    const frames = new Array(hosts.length)
    let left = hosts.length
    if (!left) g[key] = frames
    hosts.forEach((h, i) =>
      g.nativeFabricUIManager.measureInWindow(h.stateNode.node, (x, y, width, height) => {
        frames[i] = {height, width, x, y}
        if (--left === 0 && g[key + 'Call'] === call) g[key] = frames
      })
    )
  }
`
