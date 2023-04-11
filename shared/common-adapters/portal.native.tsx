import {Portal as GPortal} from '@gorhom/portal'
import * as Styles from '../styles'
import {FullWindowOverlay} from 'react-native-screens'

// useFullScreenOverlay=false is useful to stick to an onscreen element like the audio recorder
// otherwise you want it to be true so you can go above modals, aka the ... menu in an image attachment modal
export const Portal = (p: {children: React.ReactNode; hostName?: string; useFullScreenOverlay?: boolean}) => {
  const {children, hostName, useFullScreenOverlay} = p
  const fullWindow = (useFullScreenOverlay ?? true) && Styles.isIOS
  return fullWindow ? (
    <GPortal hostName={hostName}>
      <FullWindowOverlay>{children}</FullWindowOverlay>
    </GPortal>
  ) : (
    <GPortal hostName={hostName}>{children}</GPortal>
  )
}

export {PortalHost, PortalProvider} from '@gorhom/portal'
