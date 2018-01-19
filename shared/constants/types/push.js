// @flow
export type TokenType = 'apple' | 'appledev' | 'androidplay'
// FIXME: these types diverge because of react-native-push-notification. In the
// future it would be nice to make the Android push notification data structure
// resemble iOS more closely.
export type PushNotification = {
  b?: number,
  c?: string,
  convID?: string,
  m?: string,
  p?: Array<string>,
  t?: number,
  d?: number,
  x?: number,
  type?: string,
  userInteraction: boolean,
  username?: string,
}

export type State = {
  checkOnStart: boolean, // if we want to recheck on foregrounding
  token: string,
  hasPermissions: boolean, // we can get a token with no permissions!
  tokenType: ?TokenType,
  permissionsRequesting: boolean,
  permissionsPrompt: boolean,
}
