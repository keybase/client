import * as React from 'react'
import * as Kb from '@/common-adapters'
import type * as C from '@/constants'

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      modal2: {width: Kb.Styles.isMobile ? undefined : 500},
    }) as const
)

const AddToTeam = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof AddToTeam>

const Screen = (p: OwnProps) => <AddToTeam {...p.route.params} />

export default {
  getOptions: {
    modal2: true,
    modal2ClearCover: false,
    modal2Style: styles.modal2,
    modal2Type: 'DefaultFullHeight',
  },
  screen: Screen,
}
