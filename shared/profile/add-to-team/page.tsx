import * as React from 'react'
import * as Styles from '../../styles'
import type * as Container from '../../util/container'

const AddToTeam = React.lazy(async () => import('./container'))
type OwnProps = Container.ViewPropsToPageProps<typeof AddToTeam>

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

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <AddToTeam {...p.route.params} />
  </React.Suspense>
)
export default {getOptions, getScreen: () => Screen}
