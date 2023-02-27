import {Portal as GPortal} from '@gorhom/portal'
import {FullWindowOverlay} from 'react-native-screens'

export const Portal = (p: {children: React.ReactNode; hostName?: string}) => {
  const {children, hostName} = p
  return (
    <GPortal hostName={hostName}>
      <FullWindowOverlay>{children}</FullWindowOverlay>
    </GPortal>
  )
}

export {PortalHost, PortalProvider} from '@gorhom/portal'
