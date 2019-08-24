if (!__STORYBOOK__) {
  throw new Error('Invalid load of mock')
}

function* call(_: {
  method: string
  params: Object | null
  incomingCallMap: {[K in string]: any} // this is typed by the generated helpers,
  waitingKey?: string
}): any {}

export default call
