import * as Styles from '@/styles'
import {Pressable} from 'react-native'
import {Box2, ClickableBox3} from './box'
import Text from './text'
import type {IconType} from './icon.constants-gen'
import IconAuto from './icon-auto'

type Props = {
  icon: IconType
  title: string
  description: string
  onClick?: () => void
  testID?: string
}

const Kb = {Box2, ClickableBox3, IconAuto, Text}

const inner = (pressed: boolean, props: Props) => (
  <>
    <Kb.IconAuto type={props.icon} style={styles.thumbnail} />
    <Kb.Box2 direction="vertical" style={Styles.globalStyles.flexOne} gap="xtiny">
      <Kb.Text
        className="hover_contained_color_blueDark"
        style={pressed ? styles.mobileTitle : undefined}
        type="BodySemibold"
      >
        {props.title}
      </Kb.Text>
      <Kb.Text type="BodySmall">{props.description}</Kb.Text>
    </Kb.Box2>
  </>
)

const RichButton = (props: Props) => {
  if (!isMobile) {
    return (
      <Kb.ClickableBox3
        className="hover_container hover_background_color_blueLighter_20"
        direction="horizontal"
        alignItems="center"
        fullWidth={true}
        style={styles.containerStyle}
        testID={props.testID}
        onClick={props.onClick}
      >
        {inner(false, props)}
      </Kb.ClickableBox3>
    )
  }

  return (
    <Pressable
      style={({pressed}) => Styles.collapseStyles([styles.containerStyle, pressed && styles.mobileContainer])}
      testID={props.testID}
      onPress={props.onClick}
    >
      {({pressed}) => inner(pressed, props)}
    </Pressable>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  containerStyle: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    backgroundColor: Styles.globalColors.white,
    ...Styles.border(Styles.globalColors.grey, 1, Styles.borderRadius),
    justifyContent: 'flex-start',
    padding: Styles.globalMargins.small,
  },
  mobileContainer: {
    backgroundColor: Styles.globalColors.blueLighter_20,
  },
  mobileTitle: {
    color: Styles.globalColors.blueDark,
  },
  thumbnail: {
    marginRight: Styles.globalMargins.small,
  },
}))

export default RichButton
