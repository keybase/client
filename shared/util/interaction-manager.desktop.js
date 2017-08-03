// @flow

const runAfterInteractions = (f: Function) => {
  console.warn("Using runAfterInteractions in desktop. This isn't supported")
  f()
  return Promise.resolve()
}

export {runAfterInteractions}
