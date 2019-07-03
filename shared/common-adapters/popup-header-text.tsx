import * as React from 'react'
import Text from './text'
import * as Styles from '../styles'

export type HeaderTextProps = {
  color: string
  backgroundColor: string
  style?: Object
  children?: React.ReactNode
}

const PopupHeaderText = (props: HeaderTextProps) => (
  <Text
    center={true}
    type="BodySmallSemibold"
    style={Styles.collapseStyles([
      styles.text,
      {
        backgroundColor: props.backgroundColor,
        color: props.color,
      },
      props.style,
    ])}
  >
    {props.children}
  </Text>
)

const styles = Styles.styleSheetCreate({
  text: {
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.tiny,
  },
})

export default PopupHeaderText
