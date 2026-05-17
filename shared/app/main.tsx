import Router from '@/router-v2/router'
import ResetModal from '../login/reset/modal'
import GlobalError from './global-errors'
import OutOfDate from './out-of-date'
import {FsStatusProvider} from '@/fs/common/status'
import {SystemFileManagerIntegrationProvider} from '@/fs/common/sfmi'

const DesktopMain = function DesktopMain() {
  const RemoteProxies = (require('../desktop/remote/proxies.desktop') as typeof import('../desktop/remote/proxies.desktop')).default
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
  const {PortalHost} = require('@/common-adapters/portal.native') as typeof import('@/common-adapters/portal.native')
  const RuntimeStats = (require('./runtime-stats') as typeof import('./runtime-stats')).default
  const {BottomSheetModalProvider} = require('@gorhom/bottom-sheet') as typeof import('@gorhom/bottom-sheet')
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
