// Run promises in serial: http://stackoverflow.com/questions/24586110/resolve-promises-one-after-another-i-e-in-sequence
const serialPromises = (funcs: Array<() => Promise<any>>) =>
  funcs.reduce(
    (promise: Promise<any>, func: () => Promise<any>): any =>
      promise.then((result: any) => func().then(Array.prototype.concat.bind(result)) as Promise<any>),
    Promise.resolve([]) as Promise<any>
  )

export {serialPromises}
