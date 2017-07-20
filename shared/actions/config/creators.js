// @flow

import * as Constants from '../../constants/config'

function pushLoaded(isLoaded: boolean): Constants.PushLoaded {
  return {
    type: 'config:pushLoaded',
    payload: isLoaded,
  }
}

export {pushLoaded}
