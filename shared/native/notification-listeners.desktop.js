// @flow
import * as RPCTypes from '../constants/types/rpc-gen'
import shared from './notification-listeners.shared'
import {kbfsNotification} from '../util/kbfs-notifications'
import {remote} from 'electron'
import {writeLogLinesToFile} from '../util/forward-logs'
import logger from '../logger'
import {isWindows} from '../constants/platform'

// TODO(mm) Move these to their own actions
export default function(
  dispatch: Dispatch,
  getState: () => Object,
  notify: any
): RPCTypes.IncomingCallMapType {
  const fromShared: RPCTypes.IncomingCallMapType = shared(dispatch, getState, notify)
  const handlers: RPCTypes.IncomingCallMapType = {
    'keybase.1.NotifyApp.exit': () => {
      console.log('App exit requested')
      remote.app.exit(0)
    },
    'keybase.1.NotifyFS.FSActivity': ({notification}) => {
      kbfsNotification(notification, notify, getState)
    },
    'keybase.1.NotifyPGP.pgpKeyInSecretStoreFile': () => {
      RPCTypes.pgpPgpStorageDismissRpcPromise().catch(err => {
        console.warn('Error in sending pgpPgpStorageDismissRpc:', err)
      })
    },
    'keybase.1.NotifyService.shutdown': () => {
      if (isWindows) {
        console.log('Quitting due to service shutdown')
        // Quit just the app, not the service
        remote.app.quit(true)
      }
    },
    'keybase.1.NotifySession.clientOutOfDate': ({upgradeTo, upgradeURI, upgradeMsg}) => {
      const body = upgradeMsg || `Please update to ${upgradeTo} by going to ${upgradeURI}`
      notify('Client out of date!', {body}, 60 * 60)
    },
    'keybase.1.logsend.prepareLogsend': (_, response) => {
      logger
        .dump()
        .then(writeLogLinesToFile)
        .then(() => response.result())
    },
  }

  // $FlowIssue doesnt' like spreading exact types
  const combined: IncomingCallMapType = {
    ...fromShared,
    ...handlers,
  }

  return combined
}
