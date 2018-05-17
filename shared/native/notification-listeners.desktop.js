// @flow
import * as RPCTypes from '../constants/types/rpc-gen'
import sharedNotificationActions from './notification-listeners.shared'
import {kbfsNotification} from '../util/kbfs-notifications'
import {remote} from 'electron'
import {isWindows} from '../constants/platform'
import dumpLogs from '../logger/dump-log-fs'
import engine from '../engine'
import {NotifyPopup} from './notifications'

// TODO: DESKTOP-6662 - Move notification listeners to their own actions
export default (): void => {
  sharedNotificationActions()

  engine().setIncomingActionCreators('keybase.1.NotifyApp.exit', () => {
    console.log('App exit requested')
    remote.app.exit(0)
  })

  engine().setIncomingActionCreators('keybase.1.NotifyFS.FSActivity', ({notification}, _, __, getState) => [
    kbfsNotification(notification, NotifyPopup, getState),
  ])

  engine().setIncomingActionCreators('keybase.1.NotifyPGP.pgpKeyInSecretStoreFile', () => [
    RPCTypes.pgpPgpStorageDismissRpcPromise().catch(err => {
      console.warn('Error in sending pgpPgpStorageDismissRpc:', err)
    }),
  ])

  engine().setIncomingActionCreators('keybase.1.NotifyService.shutdown', ({code}) => {
    if (isWindows && code !== RPCTypes.ctlExitCode.restart) {
      console.log('Quitting due to service shutdown')
      // Quit just the app, not the service
      remote.app.quit(true)
    }
  })

  engine().setIncomingActionCreators(
    'keybase.1.NotifySession.clientOutOfDate',
    ({upgradeTo, upgradeURI, upgradeMsg}) => {
      const body = upgradeMsg || `Please update to ${upgradeTo} by going to ${upgradeURI}`
      return [NotifyPopup('Client out of date!', {body}, 60 * 60)]
    }
  )

  engine().setIncomingActionCreators('keybase.1.logsend.prepareLogsend', (_, response) => {
    dumpLogs().then(() => response && response.result())
  })
}
