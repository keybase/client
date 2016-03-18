/* @flow */

import {remote} from 'electron'

export function getAppPath (): string {
  return remote.app.getAppPath()
}
