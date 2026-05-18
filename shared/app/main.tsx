import type * as React from 'react'
import Router from '@/router-v2/router'
import ResetModal from '../login/reset/modal'
import GlobalError from './global-errors'
import OutOfDate from './out-of-date'
import {FsStatusProvider} from '@/fs/common/status'
import {SystemFileManagerIntegrationProvider} from '@/fs/common/sfmi'

const DesktopMain = function DesktopMain() {
  const {default: RemoteProxies} = require('../desktop/remote/proxies.desktop') as {default: React.ComponentType}
  return (
    <FsStatusProvider>
      <SystemFileManagerIntegrationProvider>
        <RemoteProxies />
        <Router />
        <ResetModal />
        <GlobalError />
        <OutOfDate />
      </SystemFileManagerIntegrationProvider>
    </FsStatusProvider>
  )
}

const NativeMain = () => {
  const {PortalHost} = require('@/common-adapters/portal.native') as {
    PortalHost: React.ComponentType<{name?: string; children?: React.ReactNode}>
  }
  const RuntimeStats = (require('./runtime-stats') as {default: React.ComponentType}).default
  const {BottomSheetModalProvider} = require('@gorhom/bottom-sheet') as {
    BottomSheetModalProvider: React.ComponentType<{children: React.ReactNode}>
  }
  return (
    <FsStatusProvider>
      <SystemFileManagerIntegrationProvider>
        <BottomSheetModalProvider>
          <Router />
          <PortalHost name="popup-root" />
        </BottomSheetModalProvider>
      </SystemFileManagerIntegrationProvider>
      <ResetModal />
      <GlobalError />
      <OutOfDate />
      <RuntimeStats />
    </FsStatusProvider>
  )
}

export default isMobile ? NativeMain : DesktopMain
