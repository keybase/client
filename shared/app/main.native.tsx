import Router from '@/router-v2/router'
import {PortalHost} from '@/common-adapters/portal.native'
import ResetModal from '../login/reset/modal'
import GlobalError from './global-errors'
import OutOfDate from './out-of-date'
import RuntimeStats from './runtime-stats'
import {BottomSheetModalProvider} from '@gorhom/bottom-sheet'
import {FsStatusProvider} from '@/fs/common/status'
import {SystemFileManagerIntegrationProvider} from '@/fs/common/sfmi'

const Main = () => {
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

export default Main
