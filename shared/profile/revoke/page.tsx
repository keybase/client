import * as React from 'react'
import type {PlatformsExpandedType} from '../../constants/types/more'
import type {SiteIconSet} from '../../constants/types/tracker2'

const Revoke = React.lazy(async () => import('./container'))

type OwnProps = {
  route: {
    params: {
      icon: SiteIconSet
      platform: PlatformsExpandedType
      platformHandle: string
      proofId: string
    }
  }
}

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <Revoke {...p.route.params} />
  </React.Suspense>
)
const getScreen = () => Screen

export default {profileProveWebsiteChoice: {getScreen}}
export type RouteProps = {profileAddToTeam: OwnProps['route']['params']}
