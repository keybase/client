import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as R from '@/constants/remote'
import * as RemoteGen from '../actions/remote-gen'
import Tracker from './index.desktop'
import load from '../desktop/remote/component-loader.desktop'
import {useDarkModeState} from '@/stores/darkmode'
import * as React from 'react'
import type {Props as TrackerProps} from './index.desktop'
import KB2 from '@/util/electron.desktop'

const {closeWindow} = KB2.functions

type ProxyProps = Omit<TrackerProps, 'onAccept' | 'onChat' | 'onClose' | 'onFollow' | 'onIgnoreFor24Hours' | 'onReload'>

const DarkModeSync = ({darkMode, children}: {darkMode: boolean; children: React.ReactNode}) => {
  const setSystemDarkMode = useDarkModeState(s => s.dispatch.setSystemDarkMode)
  React.useEffect(() => {
    const id = setTimeout(() => setSystemDarkMode(darkMode), 1)
    return () => clearTimeout(id)
  }, [setSystemDarkMode, darkMode])
  return <>{children}</>
}

const username = /\?param=(\w+)/.exec(window.location.search)

load<ProxyProps>({
  child: (p: ProxyProps) => (
    <DarkModeSync darkMode={p.darkMode}>
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
    </DarkModeSync>
  ),
  name: 'tracker',
  params: username?.[1] ?? '',
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
