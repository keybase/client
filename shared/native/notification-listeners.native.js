// @flow
import shared from './notification-listeners.shared'

import type {Dispatch} from '../constants/types/flux'
import type {incomingCallMapType} from '../constants/types/flow-types'

// TODO(mm) Move these to their own actions
export default function (dispatch: Dispatch, getState: () => Object, notify: any): incomingCallMapType {
  const fromShared = shared(dispatch, getState, notify)
  return {
    ...fromShared,
    'keybase.1.NotifyApp.exit': () => { },
    'keybase.1.NotifyFS.FSActivity': ({notification}) => { },
    'keybase.1.NotifyFS.FSSyncStatusResponse': () => { },
    'keybase.1.NotifyPGP.pgpKeyInSecretStoreFile': () => { },
    'keybase.1.NotifyService.shutdown': () => { },
    'keybase.1.NotifySession.clientOutOfDate': ({upgradeTo, upgradeURI, upgradeMsg}) => { },
  }
}
