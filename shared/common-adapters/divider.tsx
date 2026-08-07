import {Box2} from './box'
import * as Styles from '@/styles'
import type {StylesCrossPlatform} from '@/styles'

type Props = {style?: StylesCrossPlatform; vertical?: boolean}

const Divider = (props: Props) => {
  const styles = useStyles()
  return (
    <Box2
      direction="vertical"
      flex={1}
      style={Styles.collapseStyles([
        styles.divider,
        props.vertical ? styles.vertical : styles.horizontal,
        props.style,
      ])}
    />
  )
}

const useStyles = Styles.createStyleHook(theme => ({
  divider: {
    backgroundColor: theme.black_10,
  },
  horizontal: {
    maxHeight: Styles.hairlineWidth,
    minHeight: Styles.hairlineWidth,
  },
  vertical: {
    maxWidth: Styles.hairlineWidth,
    minWidth: Styles.hairlineWidth,
  },
}))

export default Divider
