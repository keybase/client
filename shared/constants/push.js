// @flow
import * as I from 'immutable'
import * as Types from './types/push'
import {isIOS} from '../constants/platform'
import {isDevApplePushToken} from '../local-debug'

export const tokenType = isIOS ? (isDevApplePushToken ? 'appledev' : 'apple') : 'androidplay'
export const androidSenderID = '9603251415'
export const permissionsRequestingWaitingKey = 'push:permissionsRequesting'

export const makeInitialState: I.RecordFactory<Types._State> = I.Record({
  hasPermissions: true,
  showPushPrompt: false,
  token: '',
  tokenType: null,
})
