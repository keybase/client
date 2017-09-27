// @flow

// Run promises in serial: http://stackoverflow.com/questions/24586110/resolve-promises-one-after-another-i-e-in-sequence
const serialPromises = (funcs: Array<() => Promise<*>>) =>
  funcs.reduce(
    // $FlowIssue
    (promise, func) => promise.then(result => func().then(Array.prototype.concat.bind(result))),
    // $FlowIssue
    Promise.resolve([])
  )

export {serialPromises}
