import {Portal as GPortal} from '@gorhom/portal'
import * as Styles from '../styles'
import {FullWindowOverlay} from 'react-native-screens'

export const Portal = (p: {children: React.ReactNode; hostName?: string}) => {
  const {children, hostName} = p

  return Styles.isIOS ? (
    <GPortal hostName={hostName}>
      <FullWindowOverlay>{children}</FullWindowOverlay>
    </GPortal>
  ) : (
    <GPortal hostName={hostName}>{children}</GPortal>
  )
}

export {PortalHost, PortalProvider} from '@gorhom/portal'
