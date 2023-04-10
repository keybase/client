import {Portal as GPortal} from '@gorhom/portal'
import * as Styles from '../styles'
import {FullWindowOverlay} from 'react-native-screens'
import {SafeAreaView} from '../common-adapters'
import {SafeAreaProvider, initialWindowMetrics} from 'react-native-safe-area-context'

// useFullScreenOverlay=false is useful to stick to an onscreen element like the audio recorder
// otherwise you want it to be true so you can go above modals, aka the ... menu in an image attachment modal
export const Portal = (p: {children: React.ReactNode; hostName?: string; useFullScreenOverlay?: boolean}) => {
  const {children, hostName, useFullScreenOverlay} = p
  const fullWindow = (useFullScreenOverlay ?? true) && Styles.isIOS
  return fullWindow ? (
    <GPortal hostName={hostName}>
      <FullWindowOverlay>
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <SafeAreaView style={styles.safe}>{children}</SafeAreaView>
        </SafeAreaProvider>
      </FullWindowOverlay>
    </GPortal>
  ) : (
    <GPortal hostName={hostName}>{children}</GPortal>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      safe: {flex: 1},
    } as const)
)

export {PortalHost, PortalProvider} from '@gorhom/portal'
