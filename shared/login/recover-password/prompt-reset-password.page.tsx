import * as Kb from '../../common-adapters'
import * as React from 'react'
import * as Styles from '../../styles'
import {InfoIcon} from '../../signup/common'

const ResetPassword = React.lazy(async () => import('./prompt-reset-password'))

const getOptions = () => ({
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
  headerRightActions: () => (
    <Kb.Box2 direction="horizontal" style={styles.questionBox}>
      <InfoIcon />
    </Kb.Box2>
  ),
})

const Screen = () => (
  <React.Suspense>
    <ResetPassword />
  </React.Suspense>
)

const styles = Styles.styleSheetCreate(() => ({
  questionBox: Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.tiny, 0),
}))

export default {getOptions, getScreen: () => Screen}
