import * as Kb from '../../common-adapters'
import * as React from 'react'
import * as Styles from '../../styles'
import {InfoIcon} from '../../signup/common'

const Error = React.lazy(async () => import('./error'))

const getOptions = () => ({
  gesturesEnabled: false,
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
  headerRightActions: () => (
    <Kb.Box2
      direction="horizontal"
      style={Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.tiny, 0)}
    >
      <InfoIcon />
    </Kb.Box2>
  ),
})

const Screen = () => (
  <React.Suspense>
    <Error />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
