import * as Styles from '@/styles'
import {Box2} from './box'

type PlaceholderProps = {
  style?: Styles.StylesCrossPlatform
  width?: number
}

const Placeholder = (props: PlaceholderProps) => (
  <Box2
    direction="vertical"
    style={Styles.collapseStyles([
      styles.placeholder,
      props.style,
      ...(props.width ? [{width: props.width}] : []),
    ])}
  />
)

const styles = Styles.styleSheetCreate(() => ({
  placeholder: {
    backgroundColor: Styles.globalColors.greyLight,
    borderRadius: 5,
    height: 10,
    width: 200,
  },
}))

export default Placeholder
