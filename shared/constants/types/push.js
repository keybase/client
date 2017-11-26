// @flow
export type TokenType = 'apple' | 'appledev' | 'androidplay'
// FIXME: these types diverge because of react-native-push-notification. In the
// future it would be nice to make the Android push notification data structure
// resemble iOS more closely.
export type PushNotification = {
  payload?: {
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
  },
}

export type State = {
  token: string,
  tokenType: ?TokenType,
  permissionsRequesting: boolean,
  permissionsPrompt: boolean,
}
