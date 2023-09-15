import * as React from 'react'
import * as Kb from '../common-adapters'
import {InfoIcon} from './common'

const Name = React.lazy(async () => import('./device-name'))

const getOptions = () => ({
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
  headerRightActions: () => (
    <Kb.Box2
      direction="horizontal"
      style={Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.tiny, 0)}
    >
      <InfoIcon />
    </Kb.Box2>
  ),
})

const Screen = () => (
  <React.Suspense>
    <Name />
  </React.Suspense>
)

export default {getOptions, getScreen: () => Screen}
