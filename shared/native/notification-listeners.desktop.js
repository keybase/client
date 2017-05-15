// @flow
import shared from './notification-listeners.shared'
import {kbfsNotification} from '../util/kbfs-notifications'
import {pgpKeyInSecretStoreFile} from '../constants/pgp'
import {remote} from 'electron'
import {dumpLoggers} from '../util/periodic-logger'

import type {Dispatch} from '../constants/types/flux'
import type {incomingCallMapType} from '../constants/types/flow-types'

// TODO(mm) Move these to their own actions
export default function(
  dispatch: Dispatch,
  getState: () => Object,
  notify: any
): incomingCallMapType {
  const fromShared = shared(dispatch, getState, notify)
  return {
    ...fromShared,
    'keybase.1.NotifyApp.exit': () => {
      console.log('App exit requested')
      remote.app.exit(0)
    },
    'keybase.1.NotifyFS.FSActivity': ({notification}) => {
      kbfsNotification(notification, notify, getState)
    },
    'keybase.1.NotifyPGP.pgpKeyInSecretStoreFile': () => {
      dispatch({payload: undefined, type: pgpKeyInSecretStoreFile})
    },
    'keybase.1.NotifyService.shutdown': () => {
      // console.log('Quitting due to service shutdown')
      // App quiting will call ctl stop, which will stop the service
      // remote.app.quit()
    },
    'keybase.1.NotifySession.clientOutOfDate': ({upgradeTo, upgradeURI, upgradeMsg}) => {
      const body = upgradeMsg || `Please update to ${upgradeTo} by going to ${upgradeURI}`
      notify('Client out of date!', {body}, 60 * 60)
    },
    'keybase.1.logsend.prepareLogsend': (_, response) => {
      dumpLoggers()
      response.result()
    },
  }
}
