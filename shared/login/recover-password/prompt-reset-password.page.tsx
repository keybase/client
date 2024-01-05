import * as Kb from '@/common-adapters'
import * as React from 'react'
import {InfoIcon} from '@/signup/common'

const getOptions = {
  headerBottomStyle: {height: undefined},
  headerLeft: undefined, // no back button
  headerRightActions: () => (
    <Kb.Box2 direction="horizontal" style={styles.questionBox}>
      <InfoIcon />
    </Kb.Box2>
  ),
}

const ResetPassword = React.lazy(async () => import('./prompt-reset-password'))
const Screen = () => (
  <React.Suspense>
    <ResetPassword />
  </React.Suspense>
)

const styles = Kb.Styles.styleSheetCreate(() => ({
  questionBox: Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.tiny, 0),
}))

const Page = {getOptions, getScreen: () => Screen}
export default Page
