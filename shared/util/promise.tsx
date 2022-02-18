// Run promises in serial: http://stackoverflow.com/questions/24586110/resolve-promises-one-after-another-i-e-in-sequence
const serialPromises = async (funcs: Array<() => Promise<any>>) =>
  funcs.reduce(
    (promise: Promise<any>, func: () => Promise<any>): any =>
      promise.then(async (result: any) => func().then(Array.prototype.concat.bind(result))),
    Promise.resolve([])
  )

export {serialPromises}
