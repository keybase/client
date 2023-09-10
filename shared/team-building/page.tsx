import * as C from '../constants'
import * as Kb from '../common-adapters'
import * as React from 'react'

const Building = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof Building>

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
          paddingLeft: Kb.Styles.globalMargins.xsmall,
          paddingRight: Kb.Styles.globalMargins.xsmall,
          paddingTop: Kb.Styles.globalMargins.mediumLarge,
        },
        modal2Type: 'DefaultFullWidth',
      }
    : common
}

const Screen = (p: OwnProps) => (
  <C.TBProvider namespace={p.route.params.namespace}>
    <React.Suspense>
      <Building {...p.route.params} />
    </React.Suspense>
  </C.TBProvider>
)

export default {getOptions, getScreen: () => Screen}
