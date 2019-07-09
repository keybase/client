import * as React from 'react'
import Box, {Box2} from './box'
import Icon from './icon'
import Text from './text'
import * as Styles from '../styles'

type Color = 'blue' | 'red' | 'yellow' | 'green' | 'grey'

type _Segment = {
  newline?: boolean
  onClick?: () => void
  text: string
}
type Segment = _Segment | string | null | false

type BannerParagraphProps = {
  bannerColor: Color
  content: string | Array<Segment>
}

export const BannerParagraph = (props: BannerParagraphProps) => (
  <Text type="BodySmallSemibold" style={styles.text}>
    {(Array.isArray(props.content) ? props.content : [props.content])
      .filter(Boolean)
      .map(segment => (typeof segment === 'string' ? {text: segment} : segment))
      .map((segment: _Segment, index) =>
        segment.text === ' ' ? (
          <>&nbsp;</>
        ) : (
          <React.Fragment key={index.toString()}>
            {segment.text.startsWith(' ') && <>&nbsp;</>}
            <Text
              type="BodySmallSemibold"
              style={Styles.collapseStyles([
                colorToTextColorStyles[props.bannerColor],
                !!segment.onClick && styles.underline,
              ])}
              className={Styles.classNames({
                'underline-hover-no-underline': !!segment.onClick,
              })}
              onClick={segment.onClick}
            >
              {segment.text}
            </Text>
            {segment.text.endsWith(' ') && <>&nbsp;</>}
          </React.Fragment>
        )
      )}
  </Text>
)

type BannerProps = {
  color: Color
  children: React.ReactElement<typeof BannerParagraph> | Array<React.ReactElement<typeof BannerParagraph>>
  inline?: boolean
  narrow?: boolean
  onClose?: () => void
  style?: Styles.StylesCrossPlatform | null
}

export const Banner = (props: BannerProps) => (
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
      direction="vertical"
      style={props.narrow ? styles.narrowTextContainer : styles.textContainer}
      centerChildren={true}
    >
      {props.children}
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
  underline: Styles.platformStyles({
    isMobile: {
      textDecorationLine: 'underline',
    },
  }),
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
