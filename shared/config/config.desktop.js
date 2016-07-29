// @flow

import {remote} from 'electron'

function getAppPath (): string {
  return remote.app.getAppPath()
}

export {
  getAppPath,
}
