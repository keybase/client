// @noflow
if (!__STORYBOOK__) {
  throw new Error('Invalid load of mock')
}

function* call(p: {
  method: string,
  params: ?Object,
  incomingCallMap: {[method: string]: any}, // this is typed by the generated helpers
  waitingKey?: string,
}): Generator<any, any, any> {}

export default call
