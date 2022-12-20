import Router from '../router-v2/router'
import ResetModal from '../login/reset/modal'
import GlobalError from './global-errors/container'
import OutOfDate from './out-of-date'

type Props = {}

const Main = (_: Props) => (
  <>
    <Router />
    <ResetModal />
    <GlobalError />
    <OutOfDate />
  </>
)

export default Main
