import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as R from '@/constants/remote'
import * as RemoteGen from '../constants/remote-actions'
import Tracker from './index.desktop'
import loadRemoteComponent from '../desktop/remote/component-loader.desktop'
import {getRemoteComponentParam, RemoteDarkModeSync} from '../desktop/remote/remote-component.desktop'
import type {Props as TrackerProps} from './index.desktop'
import KB2 from '@/util/electron.desktop'

const {closeWindow} = KB2.functions

type ProxyProps = Omit<TrackerProps, 'onAccept' | 'onChat' | 'onClose' | 'onFollow' | 'onIgnoreFor24Hours' | 'onReload'>

const RemoteTracker = (p: ProxyProps) => (
  <RemoteDarkModeSync darkMode={p.darkMode}>
    <Tracker
      {...p}
      onAccept={() => R.remoteDispatch(RemoteGen.createTrackerChangeFollow({follow: true, guiID: p.guiID}))}
      onChat={() => {
        R.remoteDispatch(RemoteGen.createShowMain())
        R.remoteDispatch(RemoteGen.createPreviewConversation({participant: p.trackerUsername}))
      }}
      onClose={() => {
        R.remoteDispatch(RemoteGen.createTrackerCloseTracker({guiID: p.guiID}))
        closeWindow?.()
      }}
      onFollow={() => R.remoteDispatch(RemoteGen.createTrackerChangeFollow({follow: true, guiID: p.guiID}))}
      onIgnoreFor24Hours={() => R.remoteDispatch(RemoteGen.createTrackerIgnore({guiID: p.guiID}))}
      onReload={() =>
        R.remoteDispatch(
          RemoteGen.createTrackerLoad({
            assertion: p.trackerUsername,
            forceDisplay: true,
            fromDaemon: false,
            guiID: C.generateGUIID(),
            ignoreCache: true,
            inTracker: true,
            reason: '',
          })
        )
      }
    />
  </RemoteDarkModeSync>
)

loadRemoteComponent<ProxyProps>({
  Component: RemoteTracker,
  component: 'tracker',
  param: getRemoteComponentParam(),
  style: Kb.Styles.platformStyles({
    isElectron: {
      backgroundColor: Kb.Styles.globalColors.transparent,
      borderRadius: 8,
      display: 'block',
      height: '100%',
      overflow: 'hidden',
      width: '100%',
    },
  }),
})
