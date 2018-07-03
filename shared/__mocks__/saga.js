// @noflow
if (!__STORYBOOK__) {
  throw new Error('Invalid load of mock')
}
const mocks = {
  all: () => {},
  buffers: () => {},
  call: () => {},
  callAndWrap: () => {},
  cancel: () => {},
  cancelWhen: () => {},
  cancelled: () => {},
  channel: () => {},
  closeChannelMap: () => {},
  createChannelMap: () => {},
  delay: () => {},
  effectOnChannelMap: () => {},
  fork: () => {},
  identity: () => {},
  join: () => {},
  mapSagasToChanMap: () => {},
  put: () => {},
  putOnChannelMap: () => {},
  race: () => {},
  safeTakeEvery: () => {},
  safeTakeEveryPure: () => {},
  safeTakeLatest: () => {},
  safeTakeLatestPure: () => {},
  safeTakeLatestWithCatch: () => {},
  safeTakeSerially: () => {},
  select: () => {},
  sequentially: () => {},
  singleFixedChannelConfig: () => {},
  spawn: () => {},
  take: () => {},
  takeFromChannelMap: () => {},
}
export default mocks
