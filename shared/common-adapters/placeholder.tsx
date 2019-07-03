import * as React from 'react'
import * as Styles from '../styles'
import Box from './box'

type PlaceholderProps = {
  style?: Styles.StylesCrossPlatform
  width?: number
}

const Placeholder = (props: PlaceholderProps) => (
  <Box
    style={Styles.collapseStyles([
      styles.placeholder,
      props.style,
      ...(props.width ? [{width: props.width}] : []),
    ])}
  />
)

const styles = Styles.styleSheetCreate({
  placeholder: {
    backgroundColor: Styles.globalColors.greyLight,
    borderRadius: 5,
    height: 10,
    width: 200,
  },
})

export default Placeholder
