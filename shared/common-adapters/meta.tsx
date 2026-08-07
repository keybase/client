import {Box2} from './box'
import Text from './text'
import IconAuto from './icon-auto'
import type {IconType} from './icon.constants-gen'
import * as Styles from '@/styles'

type BaseProps = {
  style?: Styles.StylesCrossPlatform
  size?: 'Small'
  color?: string
  noUppercase?: boolean
  icon?: IconType
  iconColor?: Styles.Color
}

type Props = BaseProps &
  (
    | {variant: 'new' | 'open' | 'reset' | 'revoked'; title?: never; backgroundColor?: never}
    | {variant?: never; title: string | number; backgroundColor: string}
  )

// common badge presets, centered so they sit next to text in a row
const useVariants = Styles.createThemedHook(theme => ({
  new: {backgroundColor: theme.orange, title: 'new'},
  open: {backgroundColor: theme.green, title: 'open'},
  reset: {backgroundColor: theme.red, title: 'reset'},
  revoked: {backgroundColor: theme.red, title: 'revoked'},
}) as const)

const Meta = (props: Props) => {
  const styles = useStyles()
  const variants = useVariants()
  const title = props.variant ? variants[props.variant].title : props.title
  const backgroundColor = props.variant ? variants[props.variant].backgroundColor : props.backgroundColor
  return (
    <Box2
      alignSelf={props.variant ? 'center' : 'flex-start'}
      alignItems="center"
      direction={props.icon ? 'horizontal' : 'vertical'}
      gap="xtiny"
      pointerEvents="none"
      style={Styles.collapseStyles([
        styles.container,
        backgroundColor && {backgroundColor},
        props.style,
        props.size === 'Small' && styles.containerSmall,
      ])}
    >
      {!!props.icon && <IconAuto color={props.iconColor} sizeType="Small" type={props.icon} />}
      <Text
        type={typeof title === 'number' ? 'BodySmallBold' : 'BodyTinyBold'}
        style={Styles.collapseStyles([
          styles.text,
          props.color && {color: props.color},
          props.size === 'Small' && styles.textSmall,
        ] as const)}
      >
        {props.noUppercase || typeof title === 'number' ? title : title.toUpperCase()}
      </Text>
    </Box2>
  )
}

const useStyles = Styles.createStyleHook(theme => ({
  container: {
    borderRadius: 2,
    ...Styles.paddingH(3),
  },
  containerSmall: {
    ...Styles.paddingH(2),
  },
  text: Styles.platformStyles({
    common: {
      color: theme.white,
      ...Styles.marginV(-1),
    },
    isMobile: {
      fontSize: 12,
    },
  }),
  textSmall: Styles.platformStyles({
    isElectron: {
      fontSize: 10,
    },
    isMobile: {
      fontSize: 11,
    },
  }),
}))

export default Meta
