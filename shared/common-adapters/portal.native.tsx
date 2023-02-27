import {Portal as GPortal} from '@gorhom/portal'

export const Portal = (p: {children: React.ReactNode; hostName?: string}) => {
  const {children, hostName} = p
  return <GPortal hostName={hostName}>{children}</GPortal>
}

export {PortalHost, PortalProvider} from '@gorhom/portal'
