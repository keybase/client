import Router from '../router-v2/router'
import {PortalHost} from '../common-adapters/portal.native'
import ResetModal from '../login/reset/modal'
import GlobalError from './global-errors/container'
import OutOfDate from './out-of-date'
import RuntimeStats from './runtime-stats'
import {StyleSheet} from 'react-native'

const Main = () => {
  return (
    <>
      <Router />
      <PortalHost
        name="popup-root"
        // @ts-ignore
        pointerEvents="box-none"
        style={StyleSheet.absoluteFill}
      />
      <ResetModal />
      <GlobalError />
      <OutOfDate />
      <RuntimeStats />
    </>
  )
}

export default Main
