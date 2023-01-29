// A box that flex grows but constrains children
import * as React from 'react'
import * as Styles from '../styles'
import Box, {Box2, type LayoutEvent} from './box'

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
      inner2: {...Styles.globalStyles.fillAbsolute, display: 'flex'},
      outer: {
        flexGrow: 1,
        position: 'relative',
      },
      outer2: {
        alignSelf: 'stretch',
        display: 'flex',
        flexGrow: 1,
        flexShrink: 1,
        position: 'relative',
      },
    } as const)
)

export default BoxGrow

export const BoxGrow2 = (p: Props) => {
  const {onLayout, style, children} = p
  return (
    <Box2 direction="horizontal" style={Styles.collapseStyles([styles.outer2, style])} onLayout={onLayout}>
      <Box2 direction="horizontal" style={styles.inner2}>
        {children}
      </Box2>
    </Box2>
  )
}
