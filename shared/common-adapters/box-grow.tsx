// A box that flex grows but constrains children
import * as React from 'react'
import * as Styles from '../styles'
import Box, {LayoutEvent} from './box'

type Props = {
  children?: React.ReactNode
  style?: Styles.StylesCrossPlatform
  onLayout?: (e: LayoutEvent) => void
}

class BoxGrow extends React.Component<Props> {
  render() {
    return (
      <Box style={Styles.collapseStyles([styles.outer, this.props.style])} onLayout={this.props.onLayout}>
        <Box style={styles.inner}>{this.props.children}</Box>
      </Box>
    )
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      inner: {...Styles.globalStyles.fillAbsolute},
      outer: {
        flexGrow: 1,
        position: 'relative',
      },
    } as const)
)

export default BoxGrow
