import * as React from 'react'
import * as Styles from '../styles'
import type * as Container from '../util/container'
import * as Constants from '../constants/team-building'

const Building = React.lazy(async () => import('./container'))
type OwnProps = Container.ViewPropsToPageProps<typeof Building>

const getOptions = ({route}: OwnProps) => {
  const namespace: unknown = route.params.namespace
  const common = {
    modal2: true,
    modal2AvoidTabs: false,
    modal2ClearCover: false,
    modal2Style: {alignSelf: 'center'},
    modal2Type: 'DefaultFullHeight',
  }

  return namespace === 'people'
    ? {
        ...common,
        modal2AvoidTabs: true,
        modal2ClearCover: true,
        modal2Style: {
          alignSelf: 'flex-start',
          paddingLeft: Styles.globalMargins.xsmall,
          paddingRight: Styles.globalMargins.xsmall,
          paddingTop: Styles.globalMargins.mediumLarge,
        },
        modal2Type: 'DefaultFullWidth',
      }
    : common
}

const Screen = (p: OwnProps) => (
  <Constants.Provider namespace={p.route.params.namespace}>
    <React.Suspense>
      <Building {...p.route.params} />
    </React.Suspense>
  </Constants.Provider>
)

export default {getOptions, getScreen: () => Screen}
