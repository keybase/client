// @flow
import * as React from 'react'
import {Box2} from './box'
import Icon, {castPlatformStyles as iconCastPlatformStyles} from './icon'
import Text from './text'
import * as Styles from '../styles'
import {memoize} from '../util/memoize'

type Color = 'blue' | 'red' | 'yellow' | 'green' | 'grey'

type Props = {
  actions?: Array<{
    title: string,
    onClick: () => void,
  }>,
  color: Color,
  onClose?: () => void,
  text: string,
}

const getContainerStyle = memoize((props: Props) =>
  Styles.collapseStyles([styles.container, colorToBackgroundColorStyles[props.color]])
)
const getTextStyle = memoize((props: Props) => colorToTextColorStyles[props.color])

const Banner = (props: Props) => (
  <Box2 direction="horizontal" fullWidth={true} style={getContainerStyle(props)}>
    <Box2 key="textBox" direction="horizontal" style={styles.textContainer} centerChildren={true}>
      {props.text.split(' ').map((word, index) => (
        <Text key={`word-${index}`} type="BodySmallSemibold" style={getTextStyle(props)}>
          {word}&nbsp;
        </Text>
      ))}
      {!!props.actions &&
        props.actions.map(({title, onClick}, index) => (
          <React.Fragment key={String(index)}>
            <Text
              key="action"
              type="BodySmallSemibold"
              onClick={onClick}
              style={getTextStyle(props)}
              underline={true}
            >
              {title}
            </Text>
            <Text key="space" type="BodySmallSemibold">
              &nbsp;
            </Text>
          </React.Fragment>
        ))}
    </Box2>
    {!!props.onClose && (
      <Box2 key="iconBox" direction="vertical" style={styles.iconContainer} centerChildren={true}>
        <Icon
          fontSize={Styles.isMobile ? undefined : 12}
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
    minHeight: 40,
  },
  icon: {
    padding: Styles.globalMargins.tiny,
  },
  iconContainer: {
    alignSelf: 'flex-start',
    height: 40,
  },
  textContainer: Styles.platformStyles({
    common: {
      flex: 1,
      flexWrap: 'wrap',
      paddingBottom: 8,
      paddingTop: 8,
    },
    isElectron: {
      paddingLeft: 64,
      paddingRight: 64,
    },
    isMobile: {
      paddingLeft: 24,
      paddingRight: 24,
    },
  }),
})

const colorToBackgroundColorStyles = {
  blue: {backgroundColor: Styles.globalColors.blue},
  green: {backgroundColor: Styles.globalColors.green},
  grey: {backgroundColor: Styles.globalColors.lightGrey2},
  red: {backgroundColor: Styles.globalColors.red},
  yellow: {backgroundColor: Styles.globalColors.yellow},
}

const colorToTextColorStyles = {
  blue: {color: Styles.globalColors.white},
  green: {color: Styles.globalColors.white},
  grey: {color: Styles.globalColors.black_50},
  red: {color: Styles.globalColors.white},
  yellow: {color: Styles.globalColors.brown_75},
}

export default Banner
