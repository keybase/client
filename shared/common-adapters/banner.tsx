import * as React from 'react'
import Box, {Box2} from './box'
import Icon from './icon'
import Text from './text'
import * as Styles from '../styles'

type Color = 'blue' | 'red' | 'yellow' | 'green' | 'grey'

type Props = {
  actions?: Array<{
    title: string
    onClick: () => void
  }>
  color: Color
  inline?: boolean
  narrow?: boolean
  onClose?: () => void
  text: string
  style?: Styles.StylesCrossPlatform | null
}

const Banner = (props: Props) => (
  <Box2
    direction="horizontal"
    fullWidth={true}
    style={Styles.collapseStyles([
      styles.container,
      colorToBackgroundColorStyles[props.color],
      props.inline && styles.containerInline,
      props.style,
    ])}
  >
    <Box2
      key="textBox"
      direction="horizontal"
      style={props.narrow ? styles.narrowTextContainer : styles.textContainer}
      centerChildren={true}
    >
      <Text
        type="BodySmallSemibold"
        style={Styles.collapseStyles([styles.text, colorToTextColorStyles[props.color]])}
      >
        {props.text}
        {!!props.actions &&
          props.actions.reduce(
            (parts, {title, onClick}, index) => [
              ...parts,
              <Text key={`space-${index}`} type="BodySmallSemibold">
                &nbsp;
              </Text>,
              <Text
                key={`action-${index}`}
                type="BodySmallSemibold"
                onClick={onClick}
                style={Styles.collapseStyles([colorToTextColorStyles[props.color], styles.underline])}
              >
                {title}
              </Text>,
            ],
            []
          )}
      </Text>
    </Box2>
    {!!props.onClose && (
      <Box key="iconBox" style={styles.iconContainer}>
        <Icon
          padding="xtiny"
          sizeType="Small"
          type="iconfont-close"
          color={Styles.globalColors.white_90}
          hoverColor={Styles.globalColors.white}
          onClick={props.onClose}
        />
      </Box>
    )}
  </Box2>
)

const styles = Styles.styleSheetCreate({
  container: {
    minHeight: Styles.globalMargins.large,
  },
  containerInline: {
    borderRadius: Styles.borderRadius,
  },
  iconContainer: Styles.platformStyles({
    common: {
      padding: Styles.globalMargins.xtiny,
      position: 'absolute',
      right: 0,
    },
    isElectron: {
      paddingTop: Styles.globalMargins.tiny + Styles.globalMargins.xtiny,
    },
    isMobile: {
      paddingTop: Styles.globalMargins.tiny,
    },
  }),
  narrowTextContainer: Styles.platformStyles({
    common: {
      flex: 1,
      maxWidth: '100%',
      paddingBottom: Styles.globalMargins.tiny,
      paddingTop: Styles.globalMargins.tiny,
    },
    isElectron: {
      paddingLeft: Styles.globalMargins.medium,
      paddingRight: Styles.globalMargins.medium,
    },
    isMobile: {
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
    },
  }),
  text: Styles.platformStyles({
    common: {
      maxWidth: '100%',
      textAlign: 'center',
    },
    isElectron: {
      overflowWrap: 'break-word',
    },
  }),
  textContainer: Styles.platformStyles({
    common: {
      flex: 1,
      maxWidth: '100%',
      paddingBottom: Styles.globalMargins.tiny,
      paddingTop: Styles.globalMargins.tiny,
    },
    isElectron: {
      paddingLeft: Styles.globalMargins.xlarge,
      paddingRight: Styles.globalMargins.xlarge,
    },
    isMobile: {
      paddingLeft: Styles.globalMargins.medium,
      paddingRight: Styles.globalMargins.medium,
    },
  }),
  underline: {
    textDecorationLine: 'underline',
  },
})

const colorToBackgroundColorStyles = Styles.styleSheetCreate({
  blue: {backgroundColor: Styles.globalColors.blue},
  green: {backgroundColor: Styles.globalColors.green},
  grey: {backgroundColor: Styles.globalColors.grey},
  red: {backgroundColor: Styles.globalColors.red},
  yellow: {backgroundColor: Styles.globalColors.yellow},
})

const colorToTextColorStyles = Styles.styleSheetCreate({
  blue: {color: Styles.globalColors.white},
  green: {color: Styles.globalColors.white},
  grey: {color: Styles.globalColors.black_50},
  red: {color: Styles.globalColors.white},
  yellow: {color: Styles.globalColors.brown_75},
})

export default Banner
