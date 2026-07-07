// A box that flex grows but constrains children
import * as Styles from '@/styles'
import {Box2, type LayoutEvent} from './box'

type Props = {
  children?: React.ReactNode
  style?: Styles.StylesCrossPlatform
  onLayout?: (e: LayoutEvent) => void
}

const BoxGrowImpl = (p: Props & {direction: 'vertical' | 'horizontal'}) => {
  const {direction, onLayout, style, children} = p
  return (
    <Box2
      direction={direction}
      alignSelf="stretch"
      relative={true}
      style={Styles.collapseStyles([direction === 'vertical' ? styles.outer : styles.outer2, style])}
      onLayout={onLayout}
    >
      <Box2 direction={direction} style={styles.inner}>
        {children}
      </Box2>
    </Box2>
  )
}

const BoxGrow = (p: Props) => <BoxGrowImpl {...p} direction="vertical" />
export const BoxGrow2 = (p: Props) => <BoxGrowImpl {...p} direction="horizontal" />

const styles = Styles.styleSheetCreate(
  () =>
    ({
      inner: {...Styles.globalStyles.fillAbsolute, height: '100%', width: '100%'},
      outer: {
        flexGrow: 1,
      },
      // horizontal variant also shrinks so it can't overflow its parent
      outer2: {
        flexGrow: 1,
        flexShrink: 1,
      },
    }) as const
)

export default BoxGrow
