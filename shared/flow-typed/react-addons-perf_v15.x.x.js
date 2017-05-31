// https://github.com/flowtype/flow-typed/blob/master/definitions/npm/react-addons-perf_v15.x.x/flow_v0.23.x-/react-addons-perf_v15.x.x.js
declare module 'react-addons-perf' {
  declare function start(): void
  declare function stop(): void
  declare function printWasted(): void
  declare function getLastMeasurements(): mixed
  declare function printInclusive(): void
  declare function printExclusive(): void
  declare function printOperations(): void
}
