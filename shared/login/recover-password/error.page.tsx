import * as Kb from '@/common-adapters'
import * as React from 'react'
import {InfoIcon} from '@/signup/common'

const getOptions = {
  gesturesEnabled: false,
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

const Error = React.lazy(async () => import('./error'))
const Screen = () => (
  <React.Suspense>
    <Error />
  </React.Suspense>
)

const Page = {getOptions, getScreen: () => Screen}
export default Page
