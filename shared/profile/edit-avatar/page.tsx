import * as React from 'react'
import * as Styles from '../../styles'
import type * as Container from '../../util/container'

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

const EditAvatar = React.lazy(async () => import('./container'))
type OwnProps = Container.ViewPropsToPageProps<typeof EditAvatar>

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <EditAvatar {...p.route.params} />
  </React.Suspense>
)
export default {getOptions, getScreen: () => Screen}
