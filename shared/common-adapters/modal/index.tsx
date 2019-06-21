import * as React from 'react'
import * as Styles from '../../styles'
import PopupDialog from '../popup-dialog'
import ScrollView from '../scroll-view'
import {Box2} from '../box'
import BoxGrow from '../box-grow'

const Kb = {
  Box2,
  BoxGrow,
  ScrollView,
}

type HeaderProps = {
  icon?: React.ReactNode // above center
  leftButton?: React.ReactNode
  rightButton?: React.ReactNode
  title?: React.ReactNode // center; be sure to lineClamp any long / dynamic strings
}

type FooterProps = {
  children: React.ReactNode
  hideBorder?: boolean
  style?: Styles.StylesCrossPlatform
}

type Props = {
  banners?: React.ReactNode[]
  children: React.ReactNode
  header?: HeaderProps
  onClose: () => void
  footer?: FooterProps
  mode: 'Default' | 'Wide'
}

const ModalInner = (props: Props) => (
  <>
    {!!props.header && <Header {...props.header} />}
    {!!props.banners && props.banners}
    <Kb.ScrollView alwaysBounceVertical={false}>{props.children}</Kb.ScrollView>
    {!!props.footer && <Footer {...props.footer} />}
  </>
)
const Modal = (props: Props) =>
  Styles.isMobile ? (
    <ModalInner {...props} />
  ) : (
    <PopupDialog
      onClose={props.onClose}
      styleClipContainer={props.mode === 'Default' ? styles.modeDefault : styles.modeWide}
    >
      <ModalInner {...props} />
    </PopupDialog>
  )
Modal.defaultProps = {
  mode: 'Default',
}

// TODO centering title on mobile, maybe make a separate component? might be hard to do cross platform.
const Header = (props: HeaderProps) => (
  <Kb.Box2 direction="vertical" style={props.icon ? styles.headerWithIcon : styles.header} fullWidth={true}>
    {!!props.icon && props.icon}
    <Kb.Box2 direction="horizontal" alignItems="center" fullHeight={true} style={Styles.globalStyles.flexOne}>
      {/* Boxes on left and right side of header must exist even if leftButton and rightButton aren't used so title stays centered */}
      <Kb.Box2 direction="horizontal" style={styles.headerLeft}>
        {!!props.leftButton && props.leftButton}
      </Kb.Box2>
      {props.title}
      <Kb.Box2 direction="horizontal" style={styles.headerRight}>
        {!!props.rightButton && props.rightButton}
      </Kb.Box2>
    </Kb.Box2>
  </Kb.Box2>
)

const Footer = (props: FooterProps) => (
  <Kb.Box2
    direction="vertical"
    fullWidth={true}
    style={Styles.collapseStyles([styles.footer, !props.hideBorder && styles.footerBorder, props.style])}
  >
    {props.children}
  </Kb.Box2>
)

const headerCommon = {
  borderBottomColor: Styles.globalColors.black_10,
  borderBottomWidth: 1,
  borderStyle: 'solid' as const,
}

const styles = Styles.styleSheetCreate({
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
  header: {
    ...headerCommon,
    minHeight: 48,
  },
  headerLeft: {
    flex: 1,
    flexShrink: 0,
    justifyContent: 'flex-start',
    paddingLeft: Styles.globalMargins.xsmall,
    paddingRight: Styles.globalMargins.xsmall,
  },
  headerRight: {
    flex: 1,
    flexShrink: 0,
    justifyContent: 'flex-end',
    paddingLeft: Styles.globalMargins.xsmall,
    paddingRight: Styles.globalMargins.xsmall,
  },
  headerWithIcon: {
    ...headerCommon,
    minHeight: 64,
  },
  modeDefault: Styles.platformStyles({
    isElectron: {
      maxHeight: 560,
      width: 400,
    },
  }),
  modeWide: Styles.platformStyles({
    isElectron: {
      height: 400,
      width: 560,
    },
  }),
  nativeCoverStyleOverrides: Styles.platformStyles({
    isMobile: {
      ...Styles.padding(0),
    },
  }),
})

export default Modal
