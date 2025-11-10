import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'

const getOptions = ({route}: OwnProps) => {
  const namespace: unknown = route.params.namespace
  const common = {
    headerLeft: undefined,
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

const Building = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof Building>

export default {
  getOptions,
  screen: (p: OwnProps) => (
    <C.TBProvider namespace={p.route.params.namespace}>
      <Building {...p.route.params} />
    </C.TBProvider>
  ),
}
