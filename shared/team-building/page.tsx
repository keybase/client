import type * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import {TBProvider} from '@/stores/team-building'

const getOptions = ({route}: OwnProps) => {
  const namespace: unknown = route.params.namespace
  const common = {
    headerLeft: undefined,
    modal2: true,
    modal2AvoidTabs: false,
    modal2ClearCover: false,
    modal2Style: {alignSelf: 'center'} as const,
    modal2Type: 'DefaultFullHeight',
  } as const

  return namespace === 'people'
    ? ({
        ...common,
        modal2AvoidTabs: true,
        modal2ClearCover: true,
        modal2Style: {
          alignSelf: 'flex-start',
          paddingLeft: Kb.Styles.globalMargins.xsmall,
          paddingRight: Kb.Styles.globalMargins.xsmall,
          paddingTop: Kb.Styles.globalMargins.mediumLarge,
        } as const,
        modal2Type: 'DefaultFullWidth',
      } as const)
    : common
}

const Building = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof Building>

const Screen = (p: OwnProps) => (
  <TBProvider namespace={p.route.params.namespace}>
    <Building {...p.route.params} />
  </TBProvider>
)

export default {
  getOptions,
  screen: Screen,
}
