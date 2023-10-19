import Router from '../router-v2/router'
import {PortalHost} from '../common-adapters/portal.native'
import ResetModal from '../login/reset/modal'
import GlobalError from './global-errors'
import OutOfDate from './out-of-date'
import RuntimeStats from './runtime-stats'
import {StyleSheet} from 'react-native'
import {BottomSheetModalProvider} from '@gorhom/bottom-sheet'

const Main = () => {
  return (
    <>
      <BottomSheetModalProvider>
        <Router />
        <PortalHost
          name="popup-root"
          // @ts-ignore
          pointerEvents="box-none"
          style={StyleSheet.absoluteFill}
        />
      </BottomSheetModalProvider>
      <ResetModal />
      <GlobalError />
      <OutOfDate />
      <RuntimeStats />
    </>
  )
}

export default Main
