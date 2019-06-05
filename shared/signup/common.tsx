import * as React from 'react'
import * as Container from '../util/container'
import * as Kb from '../common-adapters'
import {Props as ButtonProps} from '../common-adapters/button'
import * as Styles from '../styles'

type InfoIconProps = {
  invisible: boolean
  onDocumentation: () => void
  onFeedback: () => void
  style: Styles.StylesCrossPlatform
}

type InfoIconOwnProps = {
  invisible?: boolean
  onDocumentation?: () => void
  onFeedback?: () => void
}

const _InfoIcon = (props: Kb.PropsWithOverlay<InfoIconProps>) => (
  <>
    <Kb.Icon
      type="iconfont-question-mark"
      onClick={props.invisible ? undefined : props.toggleShowingMenu}
      ref={props.setAttachmentRef}
      style={Styles.collapseStyles([props.invisible && styles.opacityNone, props.style])}
    />
    <Kb.FloatingMenu
      items={[
        {onClick: props.onFeedback, title: 'Send feedback'},
        {onClick: props.onDocumentation, title: 'Documentation'},
      ]}
      attachTo={props.getAttachmentRef}
      visible={props.showingMenu}
      onHidden={props.toggleShowingMenu}
      closeOnSelect={true}
    />
  </>
)

export const InfoIcon = Container.namedConnect(
  () => ({}),
  // TODO: This should be a todo I guess?
  () => ({onDocumentation: () => {}, onFeedback: () => {}}),
  (s, d, o: InfoIconOwnProps) => ({...s, ...d, ...o}),
  'SignupInfoIcon'
)(Kb.OverlayParentHOC(_InfoIcon))

// Only used on desktop
const Header = props => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={props.style}>
    <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.titleContainer} fullWidth={true}>
      {props.onBack && (
        <Kb.ClickableBox onClick={props.onBack} style={styles.backButton}>
          <Kb.Box2 direction="horizontal" alignItems="center" gap="xtiny">
            <Kb.Icon
              type="iconfont-arrow-left"
              color={props.negative ? Styles.globalColors.white : Styles.globalColors.black_50}
              sizeType="Small"
              style={styles.fixIconAlignment}
            />
            <Kb.Text
              type="Body"
              style={props.negative ? undefined : styles.backText}
              negative={props.negative}
            >
              Back
            </Kb.Text>
          </Kb.Box2>
        </Kb.ClickableBox>
      )}
      {props.titleComponent || <Kb.Text type="Header">{props.title}</Kb.Text>}
    </Kb.Box2>
  </Kb.Box2>
)

type ButtonMeta = {
  disabled?: boolean
  label: string
  onClick: () => void
  type: ButtonProps['type']
}

type SignupScreenProps = {
  banners?: React.ReactNode
  buttons: Array<ButtonMeta>
  children: React.ReactNode
  negativeHeader?: boolean
  onBack?: () => void
  skipMobileHeader?: boolean
  headerStyle?: Styles.StylesCrossPlatform
  containerStyle?: Styles.StylesCrossPlatform
  title?: string
  titleComponent?: React.ReactNode
  header?: React.ReactNode
  rightActionLabel?: string
  onRightAction?: () => void | null
  leftAction?: 'back' | 'cancel'
  leftActionText?: string
}

// Screens with header + body bg color (i.e. all but join-or-login)
const _SignupScreen = (props: SignupScreenProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} alignItems="center">
    {!Styles.isMobile && (
      <Header
        onBack={props.onBack}
        title={props.title}
        titleComponent={props.titleComponent}
        style={props.headerStyle}
        negative={props.negativeHeader}
      />
    )}
    {Styles.isMobile && props.header}
    <Kb.Box2
      alignItems="center"
      direction="vertical"
      style={Styles.collapseStyles([styles.blueBackground, props.containerStyle])}
      fullWidth={true}
    >
      <Kb.Box2 alignItems="center" direction="vertical" style={styles.body} fullWidth={true}>
        {props.children}
      </Kb.Box2>
      {/* Banners after children so they go on top */}
      {!!props.banners && <Kb.Box2 direction="vertical" style={styles.banners} children={props.banners} />}
      <Kb.ButtonBar direction="column" fullWidth={Styles.isMobile} style={styles.buttonBar}>
        {props.buttons.map(b => (
          <Kb.Button key={b.label} style={styles.button} {...b} fullWidth={true} />
        ))}
      </Kb.ButtonBar>
    </Kb.Box2>
  </Kb.Box2>
)
export const SignupScreen = (props: SignupScreenProps) => {
  const Component = Styles.isMobile && !props.skipMobileHeader ? Kb.HeaderHoc(_SignupScreen) : _SignupScreen
  return <Component {...props} />
}
SignupScreen.defaultProps = {
  leftAction: 'cancel',
  leftActionText: 'Back',
}

const styles = Styles.styleSheetCreate({
  backButton: {
    bottom: Styles.globalMargins.small,
    left: Styles.globalMargins.small,
    position: 'absolute',
  },
  backText: {
    color: Styles.globalColors.black_50,
  },
  banners: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  blueBackground: {
    backgroundColor: Styles.globalColors.blueGrey,
    flex: 1,
    position: 'relative',
  },
  body: {
    ...Styles.padding(
      Styles.isMobile ? Styles.globalMargins.tiny : Styles.globalMargins.xlarge,
      Styles.globalMargins.small
    ),
    flex: 1,
  },
  button: Styles.platformStyles({
    isElectron: {
      width: 368,
    },
    isMobile: {
      width: '100%',
    },
  }),
  buttonBar: Styles.platformStyles({
    isElectron: {
      paddingBottom: Styles.globalMargins.xlarge - Styles.globalMargins.tiny, // tiny added inside buttonbar
    },
    isMobile: {
      ...Styles.padding(0, Styles.globalMargins.small, Styles.globalMargins.tiny),
    },
  }),
  fixIconAlignment: {
    position: 'relative',
    top: 2,
  },
  opacityNone: {
    opacity: 0,
  },
  titleContainer: {
    ...Styles.padding(Styles.globalMargins.xsmall, 0, Styles.globalMargins.small),
    position: 'relative',
  },
})
