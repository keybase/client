import * as React from 'react'
import * as Styles from '@/styles'
import {Box2, type LayoutEvent} from './box'
import Text from './text'

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
        <Text type="BodyTiny" lineClamp={1} center={true}>
          {props.subTitle}
        </Text>
      ) : (
        props.subTitle
      )
  }

  return (
    <Box2
      direction="vertical"
      style={Styles.collapseStyles([
        props.icon ? styles.headerWithIcon : styles.header,
        props.hideBorder && styles.headerHideBorder,
        props.style,
      ])}
      fullWidth={true}
    >
      {!!props.icon && (
        <Box2 direction="vertical" centerChildren={true}>
          {props.icon}
        </Box2>
      )}
      <Box2
        direction="horizontal"
        alignItems="center"
        fullHeight={true}
        style={Styles.globalStyles.flexOne}
      >
        <Box2 direction="horizontal" style={Styles.collapseStyles([styles.headerLeft])}>
          <Box2 direction="horizontal" onLayout={onLayoutSide}>
            {!!props.leftButton && props.leftButton}
          </Box2>
        </Box2>
        {
          <Box2 direction="vertical">
            {!!subTitle && props.subTitleAbove && subTitle}
            {typeof props.title === 'string' ? (
              <Text type={Styles.isMobile ? 'BodyBig' : 'Header'} lineClamp={1} center={true}>
                {props.title}
              </Text>
            ) : (
              props.title
            )}
            {!!subTitle && !props.subTitleAbove && subTitle}
          </Box2>
        }
        <Box2 direction="horizontal" style={Styles.collapseStyles([styles.headerRight])}>
          <Box2 direction="horizontal" onLayout={onLayoutSide}>
            {!!props.rightButton && props.rightButton}
          </Box2>
        </Box2>
      </Box2>
    </Box2>
  )
}

const Footer = (props: FooterProps & {fullscreen?: boolean; wide?: boolean}) => (
  <Box2
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
  </Box2>
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
  }
})

export {Header2 as ModalHeader, Footer as ModalFooter}
export type {HeaderProps as ModalHeaderProps, FooterProps as ModalFooterProps}
