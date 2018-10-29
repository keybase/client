// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {resolveRootAsURL} from '../../desktop/app/resolve-root.desktop'
import {urlsToImgSet} from '../../common-adapters/icon.desktop'
import type {Props} from './section-header'

const stripePattern = resolveRootAsURL('../images/icons/pattern-stripes-blue-5-black-5-desktop.png')
const stripePatternUrl = urlsToImgSet({'9': stripePattern}, 9)

const SectionHeader = (props: Props) => (
  <Kb.Box2
    direction="vertical"
    fullWidth={true}
    style={Styles.collapseStyles([
      styles.padding,
      props.striped ? styles.backgroundImage : styles.backgroundColor,
    ])}
  >
    <Kb.Text type="BodySmallSemibold">{props.title}</Kb.Text>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  backgroundColor: {
    backgroundColor: Styles.globalColors.blue5,
  },
  backgroundImage: Styles.platformStyles({
    isElectron: {
      backgroundImage: stripePatternUrl,
      backgroundRepeat: 'repeat',
      backgroundSize: '9px 9px',
    },
  }),
  padding: {
    padding: Styles.globalMargins.xtiny,
  },
})

export default SectionHeader
