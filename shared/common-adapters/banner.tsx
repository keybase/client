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

// See banner.stories.tsx for examples
type Content =
  // single paragraph content
  | string
  // single paragraph content with an array of segments
  | (Array<Segment>)
  // an array of paragraphes, each represented by an array of segments
  | Array<Array<Segment>>

type Props = {
  color: Color
  content: Content
  inline?: boolean
  narrow?: boolean
  onClose?: () => void
  style?: Styles.StylesCrossPlatform | null
}

const normalizeContent = (content: Content): Array<Array<_Segment>> => {
  if (typeof content === 'string') {
    return [[{text: content}]]
  }
  if (!content.length) {
    return []
  }
  const paragraphs: Array<Array<Segment>> = Array.isArray(content[0])
    ? (content as Array<Array<Segment>>)
    : [content as Array<Segment>]
  return paragraphs.map(
    (paragraph: Array<Segment>) =>
      paragraph
        .map((segment: Segment) => (typeof segment === 'string' ? {text: segment} : segment))
        .filter(Boolean) as Array<_Segment>
  )
}

const Banner = (props: Props) => {
  const paragraphs = normalizeContent(props.content)
  return (
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
        {paragraphs.map((paragraph, parIndex) => (
          <Text key={parIndex.toString()} type="BodySmallSemibold" style={styles.text}>
            {paragraph.map((segment: _Segment, index) =>
              segment.text === ' ' ? (
                <>&nbsp;</>
              ) : (
                <React.Fragment key={index.toString()}>
                  {segment.text.startsWith(' ') && <>&nbsp;</>}
                  <Text
                    type="BodySmallSemibold"
                    style={Styles.collapseStyles([
                      colorToTextColorStyles[props.color],
                      !!segment.onClick && styles.underline,
                    ])}
                    onClick={segment.onClick}
                  >
                    {segment.text}
                  </Text>
                  {segment.text.endsWith(' ') && <>&nbsp;</>}
                </React.Fragment>
              )
            )}
          </Text>
        ))}
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
}

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
