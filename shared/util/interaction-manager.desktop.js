// @flow

const runAfterInteractions = (f: Function) => {
  console.warn("Using runAfterInteractions in desktop. This isn't supported")
  f()
  const p: Promise<*> = Promise.resolve()
  return p
}

export {runAfterInteractions}
