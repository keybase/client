// @flow

export function requestPushPermissions (): Promise<*> {
  throw new Error('Push permissions unsupported on this platform')
}
