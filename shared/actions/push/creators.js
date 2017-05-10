// @flow
import * as Constants from '../../constants/push'

function configurePush(): Constants.ConfigurePush {
  return {type: Constants.configurePush, payload: undefined}
}

function permissionsRequest(): Constants.PushPermissionsRequest {
  return {type: Constants.permissionsRequest, payload: undefined}
}

function permissionsRequesting(
  enabled: boolean
): Constants.PushPermissionsRequesting {
  return {type: Constants.permissionsRequesting, payload: enabled}
}

function permissionsPrompt(enabled: boolean): Constants.PushPermissionsPrompt {
  return {type: Constants.permissionsPrompt, payload: enabled}
}

function pushNotification(
  notification: Constants.PushNotification
): Constants.PushNotificationAction {
  return {type: Constants.pushNotification, payload: notification}
}

function pushToken(
  token: string,
  tokenType: Constants.TokenType
): Constants.PushToken {
  return {type: Constants.pushToken, payload: {token, tokenType}}
}

function savePushToken(): Constants.SavePushToken {
  return {type: Constants.savePushToken, payload: undefined}
}

function updatePushToken(
  token: string,
  tokenType: Constants.TokenType
): Constants.UpdatePushToken {
  return {type: Constants.updatePushToken, payload: {token, tokenType}}
}

export {
  configurePush,
  permissionsRequest,
  permissionsRequesting,
  permissionsPrompt,
  pushNotification,
  pushToken,
  savePushToken,
  updatePushToken,
}
