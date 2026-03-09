import * as React from 'react'
import * as Styles from '@/styles'
import PopupDialog from './popup-dialog'
import ScrollView, {type ScrollViewRef} from './scroll-view'
import {Box2, type LayoutEvent} from './box'
import BoxGrow from './box-grow'
import Text from './text'

const Kb = {
  Box2,
  BoxGrow,
  ScrollView,
  Text,
}

type HeaderProps = {
  hideBorder?: boolean
  icon?: React.ReactNode // above center
  leftButton?: React.ReactNode
  rightButton?: React.ReactNode
  subTitle?: React.ReactNode // center; be sure to lineClamp any long / dynamic strings
  subTitleAbove?: boolean
  title?: React.ReactNode // center; be sure to lineClamp any long / dynamic strings
  style?: Styles.StylesCrossPlatform
}

type FooterProps = {
  content: React.ReactNode
  hideBorder?: boolean
  style?: Styles.StylesCrossPlatform
}

type Props = {
  allowOverflow?: boolean // desktop only
  bare?: boolean // skip PopupDialog/BoxGrow/ScrollView wrapping — for use inside router modal2 screens
  banners?: React.ReactNode
  children: React.ReactNode
  header?: HeaderProps
  onClose?: () => void // desktop non-fullscreen only
  footer?: FooterProps
  fullscreen?: boolean // desktop only. disable the popupdialog / underlay and expand to fit the screen
  mode?: 'Default' | 'DefaultFullHeight' | 'Wide'
  mobileStyle?: Styles.StylesCrossPlatform
  noScrollView?: boolean // content must push footer to bottom with this on.
  backgroundStyle?: Styles.StylesCrossPlatform
  scrollViewRef?: React.Ref<ScrollViewRef>
  scrollViewContainerStyle?: Styles.StylesCrossPlatform

  // Desktop only popup overrides
  popupStyleClipContainer?: Styles.StylesCrossPlatform
  popupStyleClose?: Styles.StylesCrossPlatform
  popupStyleContainer?: Styles.StylesCrossPlatform
  popupStyleCover?: Styles.StylesCrossPlatform
}

const Modal2Inner = (props: Props) => {
  const {header, banners, noScrollView, backgroundStyle, footer} = props
  const {children, scrollViewRef, scrollViewContainerStyle, mode, fullscreen} = props
  return (
    <>
      {header ? <Header2 {...header} /> : null}
      {banners ? banners : null}
      {noScrollView ? (
        Styles.isMobile ? (
          <Kb.BoxGrow>{children}</Kb.BoxGrow>
        ) : (
          children
        )
      ) : (
        <Kb.ScrollView
          ref={scrollViewRef}
          alwaysBounceVertical={false}
          style={Styles.collapseStyles([styles.scroll, backgroundStyle])}
          contentContainerStyle={Styles.collapseStyles([
            styles.scrollContentContainer,
            scrollViewContainerStyle,
          ])}
        >
          {children}
        </Kb.ScrollView>
      )}
      {!!footer && <Footer {...footer} wide={(mode ?? 'Default') === 'Wide'} fullscreen={!!fullscreen} />}
    </>
  )
}

const Modal2 = (props: Props) =>
  props.bare ? (
    <Modal2Bare {...props} />
  ) : Styles.isMobile || props.fullscreen ? (
    <Kb.BoxGrow>
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={props.mobileStyle}>
        <Modal2Inner {...props} />
      </Kb.Box2>
    </Kb.BoxGrow>
  ) : (
    <PopupDialog
      onClose={props.onClose}
      styleClipContainer={
        props.popupStyleClipContainer ??
        Styles.collapseStyles([
          clipContainerStyles[props.mode ?? 'Default'],
          props.allowOverflow && styles.overflowVisible,
        ])
      }
      styleClose={props.popupStyleClose}
      styleContainer={props.popupStyleContainer}
      styleCover={props.popupStyleCover}
    >
      <Modal2Inner {...props} />
    </PopupDialog>
  )

const Modal2Bare = (props: Props) => {
  const {footer, header, banners, children} = props
  return (
    <>
      {header ? <Header2 {...header} /> : null}
      {banners ? banners : null}
      {children}
      {!!footer && <Footer {...footer} wide={true} fullscreen={false} />}
    </>
  )
}

export const useModalHeaderTitleAndCancel = (title: string, onCancel: () => void): HeaderProps => ({
  leftButton: (
    <Text type="BodyBigLink" onClick={onCancel}>
      Cancel
    </Text>
  ),
  title,
})

const Header2 = (props: HeaderProps) => {
  // On native, let the header sides layout to measure which is wider.
  const [widerWidth, setWiderWidth] = React.useState(-1)
  const onLayoutSide = (evt: LayoutEvent) => {
    const {width} = evt.nativeEvent.layout
    if (width > widerWidth) {
      setWiderWidth(width)
    }
  }

  let subTitle: React.ReactNode = null
  if (props.subTitle) {
    subTitle =
      typeof props.subTitle === 'string' ? (
        <Kb.Text type="BodyTiny" lineClamp={1} center={true}>
          {props.subTitle}
        </Kb.Text>
      ) : (
        props.subTitle
      )
  }

  return (
    <Kb.Box2
      direction="vertical"
      style={Styles.collapseStyles([
        props.icon ? styles.headerWithIcon : styles.header,
        props.hideBorder && styles.headerHideBorder,
        props.style,
      ])}
      fullWidth={true}
    >
      {!!props.icon && (
        <Kb.Box2 direction="vertical" centerChildren={true}>
          {props.icon}
        </Kb.Box2>
      )}
      <Kb.Box2
        direction="horizontal"
        alignItems="center"
        fullHeight={true}
        style={Styles.globalStyles.flexOne}
      >
        <Kb.Box2 direction="horizontal" style={Styles.collapseStyles([styles.headerLeft])}>
          <Kb.Box2 direction="horizontal" onLayout={onLayoutSide}>
            {!!props.leftButton && props.leftButton}
          </Kb.Box2>
        </Kb.Box2>
        {
          <Kb.Box2 direction="vertical">
            {!!subTitle && props.subTitleAbove && subTitle}
            {typeof props.title === 'string' ? (
              <Kb.Text type={Styles.isMobile ? 'BodyBig' : 'Header'} lineClamp={1} center={true}>
                {props.title}
              </Kb.Text>
            ) : (
              props.title
            )}
            {!!subTitle && !props.subTitleAbove && subTitle}
          </Kb.Box2>
        }
        <Kb.Box2 direction="horizontal" style={Styles.collapseStyles([styles.headerRight])}>
          <Kb.Box2 direction="horizontal" onLayout={onLayoutSide}>
            {!!props.rightButton && props.rightButton}
          </Kb.Box2>
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const Footer = (props: FooterProps & {fullscreen: boolean; wide: boolean}) => (
  <Kb.Box2
    centerChildren={true}
    direction="vertical"
    fullWidth={true}
    style={Styles.collapseStyles([
      styles.footer,
      props.wide && styles.footerWide,
      props.fullscreen && styles.footerFullscreen,
      !props.hideBorder && styles.footerBorder,
      props.style,
    ] as const)}
  >
    {props.content}
  </Kb.Box2>
)

// These must match the `sideWidth` calculation above
const headerSidePadding = Styles.globalMargins.xsmall
const headerPadding = {
  paddingLeft: headerSidePadding,
  paddingRight: headerSidePadding,
}

const styles = Styles.styleSheetCreate(() => {
  const headerCommon = {
    borderBottomColor: Styles.globalColors.black_10,
    borderBottomWidth: 1,
    borderStyle: 'solid' as const,
  }

  return {
    footer: Styles.platformStyles({
      common: {
        ...Styles.padding(Styles.globalMargins.xsmall, Styles.globalMargins.small),
        minHeight: 56,
      },
      isElectron: {
        borderBottomLeftRadius: Styles.borderRadius,
        borderBottomRightRadius: Styles.borderRadius,
        overflow: 'hidden',
      },
    }),
    footerBorder: {
      borderStyle: 'solid',
      borderTopColor: Styles.globalColors.black_10,
      borderTopWidth: 1,
    },
    footerFullscreen: Styles.platformStyles({
      isElectron: {
        ...Styles.padding(
          Styles.globalMargins.xsmall,
          Styles.globalMargins.small,
          Styles.globalMargins.xlarge
        ),
      },
    }),
    footerWide: Styles.platformStyles({
      isElectron: {
        ...Styles.padding(Styles.globalMargins.xsmall, Styles.globalMargins.medium),
      },
    }),
    header: {
      ...headerCommon,
      minHeight: 48,
    },
    headerHideBorder: {
      borderBottomWidth: 0,
    },
    headerLeft: {
      ...headerPadding,
      flex: 1,
      justifyContent: 'flex-start',
    },
    headerRight: {
      ...headerPadding,
      flex: 1,
      justifyContent: 'flex-end',
    },
    headerWithIcon: {
      ...headerCommon,
      minHeight: 64,
    },
    modeDefault: Styles.platformStyles({
      isElectron: {
        maxHeight: 560,
        overflow: 'hidden',
        width: 400,
      },
    }),
    modeDefaultFullHeight: Styles.platformStyles({
      isElectron: {
        height: 560,
        overflow: 'hidden',
        width: 400,
      },
    }),
    modeWide: Styles.platformStyles({
      isElectron: {
        height: 400,
        overflow: 'hidden',
        width: 560,
      },
    }),
    overflowVisible: {overflow: 'visible'},
    scroll: Styles.platformStyles({
      isElectron: {...Styles.globalStyles.flexBoxColumn, flex: 1, position: 'relative'},
    }),
    scrollContentContainer: Styles.platformStyles({
      common: {
        ...Styles.globalStyles.flexBoxColumn,
        flexGrow: 1,
        width: '100%',
      },
      isTablet: {
        alignSelf: 'center',
        maxWidth: 600,
      },
    }),
  }
})

const clipContainerStyles = {
  Default: styles.modeDefault,
  DefaultFullHeight: styles.modeDefaultFullHeight,
  Wide: styles.modeWide,
} as const

export default Modal2
export {Header2 as ModalHeader}
