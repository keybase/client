// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {NativeImage} from '../../common-adapters/native-wrappers.native'
import type {Props} from './section-header'

const stripePatternUrl = require('../../images/icons/pattern-stripes-blue-5-black-5-mobile.png')

const SectionHeader = (props: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
    {props.striped && (
      <NativeImage source={stripePatternUrl} resizeMode="repeat" style={styles.backgroundImage} />
    )}
    <Kb.Text type="BodySmallSemibold">{props.title}</Kb.Text>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  backgroundImage: {...Styles.globalStyles.fillAbsolute, height: 'auto', width: 'auto'},
  container: {
    backgroundColor: Styles.globalColors.blue5,
    padding: Styles.globalMargins.xtiny,
    position: 'relative',
  },
})

export default SectionHeader
