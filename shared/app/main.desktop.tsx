import Router from '@/router-v2/router'
import ResetModal from '../login/reset/modal'
import GlobalError from './global-errors'
import OutOfDate from './out-of-date'
import RemoteProxies from '../desktop/remote/proxies.desktop'
import {FsStatusProvider} from '@/fs/common/status'

const Main = function Main() {
  return (
    <FsStatusProvider>
      <RemoteProxies />
      <Router />
      <ResetModal />
      <GlobalError />
      <OutOfDate />
    </FsStatusProvider>
  )
}
// get focus so react doesn't hold onto old divs

export default Main
