if (!__STORYBOOK__) {
  throw new Error('Invalid load of mock')
}

const reduxSaga = {
  buffers: () => {},
  channel: () => {},
  delay: () => {},
}

const effects = {
  all: () => {},
  call: () => {},
  cancel: () => {},
  cancelled: () => {},
  fork: () => {},
  join: () => {},
  put: () => {},
  race: () => {},
  select: () => {},
  spawn: () => {},
  take: () => {},
  takeEvery: () => {},
  takeLatest: () => {},
  throttle: () => {},
}

const mocks = {
  ...reduxSaga,
  ...effects,
  actionToAction: () => {},
  identity: () => {},
  safeTakeEvery: () => {},
  safeTakeEveryPure: () => {},
  sequentially: () => {},
}

export default mocks
