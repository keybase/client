// @flow
import * as React from 'react'
import Text from './text'
import * as Styles from '../styles'

export type HeaderTextProps = {
  color: string,
  backgroundColor: string,
  style?: Object,
  children?: React.Node,
}

const PopupHeaderText = (props: HeaderTextProps) => (
  <Text
    type="BodySmallSemibold"
    style={Styles.collapseStyles([
      styles.text,
      {
        color: props.color,
        backgroundColor: props.backgroundColor,
      },
      props.style,
    ])}
  >
    {props.children}
  </Text>
)

const styles = Styles.styleSheetCreate({
  text: {
    textAlign: 'center',
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.tiny,
    paddingBottom: Styles.globalMargins.tiny,
  },
})

export default PopupHeaderText
