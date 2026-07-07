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
const variants = {
  new: {backgroundColor: Styles.globalColors.orange, title: 'new'},
  open: {backgroundColor: Styles.globalColors.green, title: 'open'},
  reset: {backgroundColor: Styles.globalColors.red, title: 'reset'},
  revoked: {backgroundColor: Styles.globalColors.red, title: 'revoked'},
} as const

const Meta = (props: Props) => {
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

const styles = Styles.styleSheetCreate(() => ({
  container: {
    borderRadius: 2,
    ...Styles.paddingH(3),
  },
  containerSmall: {
    ...Styles.paddingH(2),
  },
  text: Styles.platformStyles({
    common: {
      color: Styles.globalColors.white,
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
