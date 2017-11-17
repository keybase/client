// @flow
import type {State} from './types/pinentry'

const initialState: State = {
  pinentryStates: {
    test1: {
      closed: false,
      sessionID: 123,
      features: {
        showTyping: {allow: true, defaultValue: true, readonly: false, label: 'show the typing now'},
      },
      type: 2,
      prompt: 'enter it',
      windowTitle: 'window title',
      canceled: false,
      submitted: false,
      submitLabel: 'submit it',
      cancelLabel: 'cancel it',
      retryLabel: 'retry it',
    },
  },
  // pinentryStates: {},
  started: false,
}

export {initialState}
