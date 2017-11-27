// @flow
import * as I from 'immutable'
import * as Types from './types/pinentry'

// const initialState: State = {
// // pinentryStates: {
// // '123454321': {
// // closed: false,
// // sessionID: 123,
// // features: {
// // showTyping: {allow: true, defaultValue: true, readonly: false, label: 'show the typing now'},
// // },
// // type: 2,
// // prompt: 'enter it',
// // windowTitle: 'window title',
// // canceled: false,
// // submitted: false,
// // submitLabel: 'submit it',
// // cancelLabel: 'cancel it',
// // retryLabel: 'retry it',
// // },
// // },
// sessionIDToPinentry: {},
// }

// export {initialState}

const makeState: I.RecordFactory<Types.State> = I.Record({
  sessionIDToPinentry: I.Map(),
})

export {makeState}
