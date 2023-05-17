import * as React from 'react'
import * as Styles from '../../styles'
import type * as Container from '../../util/container'

export const options = {}

const getOptions = () => ({
  modal2: true,
  modal2ClearCover: false,
  modal2Style: styles.modal2,
  modal2Type: 'DefaultFullHeight',
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      modal2: {width: Styles.isMobile ? undefined : 500},
    } as const)
)

const ProfileLazy = React.lazy(async () => import('./container'))

const Screen = (p: Container.RouteProps2<'profileAddToTeam'>) => (
  <React.Suspense>
    <ProfileLazy username={p.route.params.username} />
  </React.Suspense>
)
const getScreen = () => Screen

export default {profileAddToTeam: {getOptions, getScreen}}
