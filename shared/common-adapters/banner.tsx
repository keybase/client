import * as React from 'react'
import Box, {Box2} from './box'
import Icon from './icon'
import Text from './text'
import * as Styles from '../styles'

type Color = 'blue' | 'red' | 'yellow' | 'green' | 'grey' | 'white'

type _Segment = {
  onClick?: () => void
  text: string
}
type Segment = _Segment | string | null | false

type BannerParagraphProps = {
  bannerColor: Color
  content: string | Array<Segment>
  inline?: boolean
  selectable?: boolean
  small?: boolean
}

export const BannerParagraph = (props: BannerParagraphProps) => (
  <Text
    type={props.small ? 'BodyTinySemibold' : 'BodySmallSemibold'}
    style={Styles.collapseStyles([styles.text, props.inline && styles.inlineText])}
  >
    {(Array.isArray(props.content) ? props.content : [props.content])
      .reduce<Array<_Segment | string>>((arr, s) => {
        s && arr.push(s)
        return arr
      }, [])
      .map(segment => (typeof segment === 'string' ? {text: segment} : segment))
      .map((segment: _Segment, index) =>
        segment.text === ' ' ? (
          <>&nbsp;</>
        ) : (
          <React.Fragment key={index.toString()}>
            {segment.text.startsWith(' ') && <>&nbsp;</>}
            <Text
              selectable={props.selectable}
              type={props.small ? 'BodyTinySemibold' : 'BodySmallSemibold'}
              style={Styles.collapseStyles([
                colorToTextColorStyles[props.bannerColor],
                !!segment.onClick && styles.underline,
              ])}
              className={Styles.classNames({
                'underline-hover-no-underline': !!segment.onClick,
              })}
              onClick={segment.onClick}
            >
              {segment.text.trim()}
            </Text>
            {segment.text.endsWith(' ') && <>&nbsp;</>}
          </React.Fragment>
        )
      )}
  </Text>
)

type BannerProps = {
  color: Color
  children:
    | string
    | React.ReactElement<typeof BannerParagraph>
    | Array<React.ReactElement<typeof BannerParagraph>>
  inline?: boolean
  narrow?: boolean
  onClose?: () => void
  small?: boolean
  style?: Styles.StylesCrossPlatform | null
  textContainerStyle?: Styles.StylesCrossPlatform | null
}

export const Banner = (props: BannerProps) => (
  <Box2
    direction="horizontal"
    fullWidth={true}
    style={Styles.collapseStyles([
      styles.container,
      colorToBackgroundColorStyles[props.color],
      props.inline && styles.containerInline,
      props.small && styles.containerSmall,
      props.style,
    ])}
  >
    <Box2
      key="textBox"
      direction="vertical"
      style={Styles.collapseStyles([
        props.narrow
          ? styles.narrowTextContainer
          : props.inline
          ? styles.inlineTextContainer
          : props.small
          ? styles.smallTextContainer
          : styles.textContainer,
        props.textContainerStyle,
      ])}
      centerChildren={true}
    >
      {typeof props.children === 'string' ? (
        <BannerParagraph
          bannerColor={props.color}
          content={props.children}
          inline={props.inline}
          small={props.small}
        />
      ) : (
        props.children
      )}
    </Box2>
    {!!props.onClose && (
      <Box key="iconBox" style={styles.iconContainer}>
        <Icon
          padding="xtiny"
          sizeType="Small"
          type="iconfont-close"
          color={colorToIconColor()[props.color]}
          hoverColor={colorToIconHoverColor()[props.color]}
          onClick={props.onClose}
        />
      </Box>
    )}
  </Box2>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: Styles.platformStyles({isElectron: {minHeight: 32}, isMobile: {minHeight: 40}}),
      containerInline: Styles.platformStyles({
        common: {borderRadius: Styles.borderRadius},
        isElectron: {
          maxWidth: '75%',
          minWidth: 352,
        },
      }),
      containerSmall: {minHeight: 28},
      iconContainer: Styles.platformStyles({
        common: {
          padding: Styles.globalMargins.xtiny,
          position: 'absolute',
          right: 0,
        },
        isElectron: {paddingTop: Styles.globalMargins.tiny},
        isMobile: {paddingTop: Styles.globalMargins.tiny},
      }),
      inlineText: {textAlign: 'left'},
      inlineTextContainer: {
        paddingBottom: Styles.globalMargins.tiny,
        paddingLeft: Styles.globalMargins.small,
        paddingRight: Styles.globalMargins.small,
        paddingTop: Styles.globalMargins.tiny,
      },
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
      smallTextContainer: {
        flex: 1,
        maxWidth: '100%',
        paddingBottom: Styles.globalMargins.xxtiny,
        paddingTop: Styles.globalMargins.xxtiny,
      },
      text: Styles.platformStyles({
        common: {
          maxWidth: '100%',
          textAlign: 'center',
        },
        isElectron: {overflowWrap: 'break-word'},
      }),
      textContainer: Styles.platformStyles({
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
      underline: Styles.platformStyles({
        isMobile: {textDecorationLine: 'underline'},
      }),
    } as const)
)

const colorToBackgroundColorStyles = Styles.styleSheetCreate(() => ({
  blue: {backgroundColor: Styles.globalColors.blue},
  green: {backgroundColor: Styles.globalColors.green},
  grey: {backgroundColor: Styles.globalColors.blueGreyLight},
  red: {backgroundColor: Styles.globalColors.red},
  white: {backgroundColor: Styles.globalColors.white},
  yellow: {backgroundColor: Styles.globalColors.yellow},
}))

const colorToTextColorStyles = Styles.styleSheetCreate(() => ({
  blue: {color: Styles.globalColors.white},
  green: {color: Styles.globalColors.white},
  grey: {color: Styles.globalColors.black_50},
  red: {color: Styles.globalColors.white},
  white: {color: Styles.globalColors.black_50},
  yellow: {color: Styles.globalColors.brown_75},
}))

const colorToIconColor = () => ({
  blue: Styles.globalColors.white_90,
  green: Styles.globalColors.white_90,
  grey: Styles.globalColors.black_50,
  red: Styles.globalColors.white_90,
  white: Styles.globalColors.black_50,
  yellow: Styles.globalColors.brown_75,
})

const colorToIconHoverColor = () => ({
  blue: Styles.globalColors.white,
  green: Styles.globalColors.white,
  grey: Styles.globalColors.black,
  red: Styles.globalColors.white,
  white: Styles.globalColors.black,
  yellow: Styles.globalColors.brown,
})
