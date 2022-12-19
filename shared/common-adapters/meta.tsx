import {Box2} from './box'
import Text from './text'
import Icon from './icon'
import type {IconType} from './icon.constants-gen'
import * as Styles from '../styles'

type Props = {
  title: string | number
  style?: Styles.StylesCrossPlatform
  size?: 'Small'
  color?: string
  backgroundColor: string
  noUppercase?: boolean
  icon?: IconType
  iconColor?: Styles.Color
}

const Meta = (props: Props) => (
  <Box2
    alignSelf="flex-start"
    alignItems="center"
    direction={props.icon ? 'horizontal' : 'vertical'}
    pointerEvents="none"
    style={Styles.collapseStyles([
      styles.container,
      props.backgroundColor && {backgroundColor: props.backgroundColor},
      props.style,
      props.size === 'Small' && styles.containerSmall,
    ])}
  >
    {!!props.icon && <Icon color={props.iconColor} sizeType="Small" style={styles.icon} type={props.icon} />}
    <Text
      type={typeof props.title === 'number' ? 'BodySmallBold' : 'BodyTinyBold'}
      style={Styles.collapseStyles([
        styles.text,
        props.color && {color: props.color},
        props.size === 'Small' && styles.textSmall,
      ] as const)}
    >
      {props.noUppercase || typeof props.title === 'number' ? props.title : props.title.toUpperCase()}
    </Text>
  </Box2>
)

const styles = Styles.styleSheetCreate(() => ({
  container: {
    borderRadius: 2,
    paddingLeft: 3,
    paddingRight: 3,
  },
  containerSmall: {
    paddingLeft: 2,
    paddingRight: 2,
  },
  icon: {
    paddingRight: Styles.globalMargins.xtiny,
  },
  text: Styles.platformStyles({
    common: {
      color: Styles.globalColors.white,
      marginBottom: -1,
      marginTop: -1,
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
