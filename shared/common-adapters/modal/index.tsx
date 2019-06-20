import * as React from 'react'
import * as Styles from '../../styles'
import PopupDialog from '../popup-dialog'
import ScrollView from '../scroll-view'
import {Box2} from '../box'

const Kb = {
  Box2,
  ScrollView,
}

// hmm, maybe string literals would be less of a pain
enum Mode {
  Default,
  Wide,
}

type HeaderProps = {
  icon?: React.ReactNode // above center
  leftButton?: React.ReactNode
  rightButton?: React.ReactNode
  title?: React.ReactNode // center
}

type Props = {
  banners?: React.ReactNode
  children: React.ReactNode
  header?: HeaderProps
  onClose: () => void
  footer?: React.ReactNode
  mode: Mode
}

const Modal = (props: Props) => (
  <PopupDialog
    onClose={props.onClose}
    styleClipContainer={props.mode === Mode.Default ? styles.modeDefault : styles.modeWide}
    styleCover={styles.nativeCoverStyleOverrides}
  >
    {!!props.header && <Header {...props.header} />}
    {/* TODO fix scrolling with small content */}
    <Kb.ScrollView contentContainerStyle={styles.body}>{props.children}</Kb.ScrollView>
  </PopupDialog>
)
Modal.defaultProps = {
  mode: Mode.Default,
}

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

const headerCommon = {
  borderBottomColor: Styles.globalColors.black_10,
  borderBottomStyle: 'solid',
  borderBottomWidth: 1,
}

const styles = Styles.styleSheetCreate({
  body: {
    ...Styles.globalStyles.flexBoxColumn,
    height: '100%',
  },
  header: {
    ...headerCommon,
    minHeight: 48,
  },
  headerLeft: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingLeft: Styles.globalMargins.xsmall,
  },
  headerRight: {
    flex: 1,
    justifyContent: 'flex-end',
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
