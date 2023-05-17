import * as React from 'react'
import * as Styles from '../../styles'

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

const AddToTeam = React.lazy(async () => import('./container'))

type OwnProps = {route: {params: {username: string}}}

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <AddToTeam {...p.route.params} />
  </React.Suspense>
)
const getScreen = () => Screen

export default {profileAddToTeam: {getOptions, getScreen}}
export type RouteProps = {profileAddToTeam: OwnProps['route']['params']}
