// @flow
import * as React from 'react'
import {Box2} from './box'
import Icon, {castPlatformStyles as iconCastPlatformStyles} from './icon'
import Text from './text'
import * as Styles from '../styles'

type Color = 'blue' | 'red' | 'yellow' | 'green' | 'grey'

type Props = {
  actions?: Array<{
    title: string,
    onClick: () => void,
  }>,
  color: Color,
  inline?: boolean,
  onClose?: () => void,
  text: string,
}

const Banner = (props: Props) => (
  <Box2
    direction="horizontal"
    fullWidth={true}
    style={Styles.collapseStyles([
      styles.container,
      colorToBackgroundColorStyles[props.color],
      props.inline && styles.containerInline,
    ])}
  >
    <Box2 key="textBox" direction="horizontal" style={styles.textContainer} centerChildren={true}>
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
                style={colorToTextColorStyles[props.color]}
                underline={true}
              >
                {title}
              </Text>,
            ],
            []
          )}
      </Text>
    </Box2>
    {!!props.onClose && (
      <Box2 key="iconBox" direction="vertical" style={styles.iconContainer} centerChildren={true}>
        <Icon
          fontSize={Styles.isMobile ? undefined : Styles.globalMargins.xsmall}
          type="iconfont-close"
          style={iconCastPlatformStyles(styles.icon)}
          color={Styles.globalColors.white_90}
          hoverColor={Styles.globalColors.white}
          onClick={props.onClose}
        />
      </Box2>
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
  icon: {
    padding: Styles.globalMargins.tiny,
  },
  iconContainer: {
    alignSelf: 'flex-start',
    height: Styles.globalMargins.large,
  },
  text: {
    textAlign: 'center',
  },
  textContainer: Styles.platformStyles({
    common: {
      flex: 1,
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
})

const colorToBackgroundColorStyles = Styles.styleSheetCreate({
  blue: {backgroundColor: Styles.globalColors.blue},
  green: {backgroundColor: Styles.globalColors.green},
  grey: {backgroundColor: Styles.globalColors.lightGrey2},
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
