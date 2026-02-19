import type * as React from 'react'
import {Text3} from './text3'
import * as Styles from '@/styles'

export type HeaderTextProps = {
  color: string
  backgroundColor: string
  style?: object
  children?: React.ReactNode
}

const PopupHeaderText = (props: HeaderTextProps) => (
  <Text3
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
  </Text3>
)

const styles = Styles.styleSheetCreate(() => ({
  text: {
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.tiny,
  },
}))

export default PopupHeaderText
