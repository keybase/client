import Router from '@/router-v2/router'
import ResetModal from '../login/reset/modal'
import GlobalError from './global-errors'
import OutOfDate from './out-of-date'
import {FsStatusProvider} from '@/fs/common/status'
import {SystemFileManagerIntegrationProvider} from '@/fs/common/sfmi'
import RemoteProxies from '../desktop/remote/proxies.desktop'
import {PortalHost} from '@/common-adapters/portal.native'
import RuntimeStats from './runtime-stats'
import {BottomSheetModalProvider} from '@gorhom/bottom-sheet'

const DesktopMain = function DesktopMain() {
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
