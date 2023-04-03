import * as React from 'react'
import * as Styles from '../../styles'
import PopupDialog from '../popup-dialog'
import ScrollView from '../scroll-view'
import {Box2, Box, type LayoutEvent} from '../box'
import BoxGrow from '../box-grow'
import Text from '../text'
import {useTimeout} from '../use-timers'

const Kb = {
  Box,
  Box2,
  BoxGrow,
  ScrollView,
  Text,
  useTimeout,
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
  banners?: React.ReactNode
  children: React.ReactNode
  header?: HeaderProps
  onClose?: () => void // desktop non-fullscreen only
  footer?: FooterProps
  fullscreen?: boolean // desktop only. disable the popupdialog / underlay and expand to fit the screen
  mode: 'Default' | 'DefaultFullHeight' | 'Wide'
  mobileStyle?: Styles.StylesCrossPlatform
  noScrollView?: boolean // content must push footer to bottom with this on.
  backgroundStyle?: Styles.StylesCrossPlatform
  scrollViewRef?: React.Ref<ScrollView>
  scrollViewContainerStyle?: Styles.StylesCrossPlatform

  // Desktop only popup overrides
  popupStyleClose?: Styles.StylesCrossPlatform
  popupStyleContainer?: Styles.StylesCrossPlatform
  popupStyleCover?: Styles.StylesCrossPlatform
}

const ModalInner = (props: Props) => (
  <>
    {props.header ? <Header {...props.header} /> : null}
    {props.banners ? props.banners : null}
    {props.noScrollView ? (
      Styles.isMobile ? (
        <Kb.BoxGrow>{props.children}</Kb.BoxGrow>
      ) : (
        props.children
      )
    ) : (
      <Kb.ScrollView
        ref={props.scrollViewRef}
        alwaysBounceVertical={false}
        style={Styles.collapseStyles([styles.scroll, props.backgroundStyle])}
        contentContainerStyle={Styles.collapseStyles([
          styles.scrollContentContainer,
          props.scrollViewContainerStyle,
        ])}
      >
        {props.children}
      </Kb.ScrollView>
    )}
    {!!props.footer && (
      <Footer {...props.footer} wide={props.mode === 'Wide'} fullscreen={!!props.fullscreen} />
    )}
  </>
)

/** TODO being deprecated. if you change this change modal2 and talk to #frontend **/
const Modal = (props: Props) =>
  Styles.isMobile || props.fullscreen ? (
    <Kb.BoxGrow>
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={props.mobileStyle}>
        <ModalInner {...props} />
      </Kb.Box2>
    </Kb.BoxGrow>
  ) : (
    <PopupDialog
      onClose={props.onClose}
      styleClipContainer={Styles.collapseStyles([
        clipContainerStyles[props.mode],
        props.allowOverflow && styles.overflowVisible,
      ])}
      styleClose={props.popupStyleClose}
      styleContainer={props.popupStyleContainer}
      styleCover={props.popupStyleCover}
    >
      <ModalInner {...props} />
    </PopupDialog>
  )
Modal.defaultProps = {
  mode: 'Default',
}

const Header = (props: HeaderProps) => {
  // On native, let the header sides layout for 100ms to measure which is wider.
  // Then, set this as the `width` of the sides and let the center expand.
  const [measured, setMeasured] = React.useState(false)
  const setMeasuredLater = Kb.useTimeout(() => setMeasured(true), 100)
  const [widerWidth, setWiderWidth] = React.useState(-1)
  const onLayoutSide = React.useCallback(
    (evt: LayoutEvent) => {
      if (measured) {
        return
      }
      const {width} = evt.nativeEvent.layout
      if (width > widerWidth) {
        setWiderWidth(width)
        setMeasuredLater()
      }
    },
    [measured, widerWidth, setMeasuredLater]
  )
  const sideWidth = widerWidth + headerSidePadding * 2
  // end mobile only

  let subTitle: React.ReactNode
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

  const showTitle = measured || !Styles.isMobile
  const useMeasuredStyles = measured && Styles.isMobile
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
        {/* Boxes on left and right side of header must exist even if leftButton and rightButton aren't used so title stays centered */}
        <Kb.Box2
          direction="horizontal"
          style={Styles.collapseStyles([styles.headerLeft, useMeasuredStyles && {flex: 0, width: sideWidth}])}
        >
          <Kb.Box2 direction="horizontal" onLayout={onLayoutSide}>
            {!!props.leftButton && props.leftButton}
          </Kb.Box2>
        </Kb.Box2>
        {showTitle && (
          <Kb.Box style={useMeasuredStyles ? styles.measured : undefined}>
            {!!subTitle && props.subTitleAbove && subTitle}
            {typeof props.title === 'string' ? (
              <Kb.Text type={Styles.isMobile ? 'BodyBig' : 'Header'} lineClamp={1} center={true}>
                {props.title}
              </Kb.Text>
            ) : (
              props.title
            )}
            {!!subTitle && !props.subTitleAbove && subTitle}
          </Kb.Box>
        )}
        <Kb.Box2
          direction="horizontal"
          style={Styles.collapseStyles([
            styles.headerRight,
            useMeasuredStyles && {flex: 0, width: sideWidth},
          ])}
        >
          <Kb.Box2 direction="horizontal" onLayout={onLayoutSide}>
            {!!props.rightButton && props.rightButton}
          </Kb.Box2>
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )
}

export const useModalHeaderTitleAndCancel = (title: string, onCancel: () => void): HeaderProps =>
  React.useMemo(
    () => ({
      leftButton: (
        <Kb.Text type="BodyBigLink" onClick={onCancel}>
          Cancel
        </Kb.Text>
      ),
      title,
    }),
    [title, onCancel]
  )

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
    measured: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
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

const clipContainerStyles: {[k in Props['mode']]: Styles.StylesCrossPlatform} = {
  Default: styles.modeDefault,
  DefaultFullHeight: styles.modeDefaultFullHeight,
  Wide: styles.modeWide,
}

export default Modal
export {Header}
