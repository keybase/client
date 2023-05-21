import * as React from 'react'
import * as Styles from '../styles'
import * as Kb from '../common-adapters'
import {InfoIcon} from './common'

const Username = React.lazy(async () => import('./username'))

const getOptions = () => ({
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
    <Username />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
