import * as React from 'react'
import * as Kb from '@/common-adapters'
import {InfoIcon} from '@/signup/common'

const getOptions = {
  headerBottomStyle: {height: undefined},
  headerLeft: undefined, // no back button
  headerRightActions: () => (
    <Kb.Box2
      direction="horizontal"
      style={Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.tiny, 0)}
    >
      <InfoIcon />
    </Kb.Box2>
  ),
}

const Paper = React.lazy(async () => import('./paper-key'))
const Screen = () => (
  <React.Suspense>
    <Paper />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
