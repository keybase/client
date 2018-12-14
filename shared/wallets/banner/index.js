// @flow
import * as React from 'react'
import {Box2, Text} from '../../common-adapters'
import type {Background} from '../../common-adapters/text'
import {backgroundModeToColor, collapseStyles, globalMargins, styleSheetCreate} from '../../styles'

type Props = {
  background: Background,
  text: string,
}

const Banner = (props: Props) => (
  <Box2
    direction="vertical"
    fullWidth={true}
    centerChildren={true}
    style={collapseStyles([styles.container, {backgroundColor: backgroundModeToColor[props.background]}])}
  >
    <Text type="BodySmallSemibold" style={styles.text} backgroundMode={props.background}>
      {props.text}
    </Text>
  </Box2>
)

const styles = styleSheetCreate({
  container: {
    minHeight: 40,
    padding: globalMargins.small,
    paddingBottom: globalMargins.tiny,
    paddingTop: globalMargins.tiny,
  },
  text: {
    textAlign: 'center',
  },
})

export default Banner
