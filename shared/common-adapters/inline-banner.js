// @flow
import * as React from 'react'
import Box2 from './box'
import Text, {type Background} from './text'
import * as Styles from '../styles'

// Show a banner inline in a layout
//
// This adapter is a WIP as of 11/1/2018, add props and functionality as new
// implementations need them

type Props = {
  backgroundMode: Background,
  centerText?: boolean,
  text: string,
}

const InlineBanner = (props: Props) => (
  <Box2
    direction="horizontal"
    style={Styles.collapseStyles([
      styles.container,
      {backgroundColor: Styles.backgroundModeToColor[props.backgroundMode]},
    ])}
  >
    <Text
      type="BodySemibold"
      backgroundMode={props.backgroundMode}
      style={props.centerText ? styles.textAlignCenter : null}
    >
      {props.text}
    </Text>
  </Box2>
)

const styles = Styles.styleSheetCreate({
  container: {
    borderRadius: 4,
    padding: Styles.globalMargins.xsmall,
  },
  textAlignCenter: {
    textAlign: 'center',
  },
})

export default InlineBanner
