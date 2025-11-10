import * as React from 'react'
import * as Kb from '@/common-adapters'
import {InfoIcon} from './common'

const Username = React.lazy(async () => import('./username'))

export default {
  getOptions: {
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
  },
  screen: Username,
}
