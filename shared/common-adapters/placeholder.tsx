import * as Styles from '@/styles'
import {Box2} from './box'

type PlaceholderProps = {
  style?: Styles.StylesCrossPlatform
  width?: number
}

const Placeholder = (props: PlaceholderProps) => {
  const styles = useStyles()
  return (
    <Box2
      direction="vertical"
      style={Styles.collapseStyles([
        styles.placeholder,
        props.style,
        props.width ? {width: props.width} : undefined,
      ])}
    />
  )
}

const useStyles = Styles.createStyleHook(theme => ({
  placeholder: {
    backgroundColor: theme.greyLight,
    borderRadius: 5,
    height: 10,
    width: 200,
  },
}))

export default Placeholder
