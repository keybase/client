import * as React from 'react'
import * as Kb from '@/common-adapters'
import type * as C from '@/constants'

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      modal2: {width: Kb.Styles.isMobile ? undefined : 500},
    }) as const
)
const getOptions = {
  modal2: true,
  modal2ClearCover: false,
  modal2Style: styles.modal2,
  modal2Type: 'DefaultFullHeight',
}

const AddToTeam = React.lazy(async () => import('./container'))
type OwnProps = C.ViewPropsToPageProps<typeof AddToTeam>
const Screen = (p: OwnProps) => (
  <React.Suspense>
    <AddToTeam {...p.route.params} />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
