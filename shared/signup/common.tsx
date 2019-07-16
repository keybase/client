import * as React from 'react'
import * as Container from '../util/container'
import * as Kb from '../common-adapters'
import * as RouteTreeGen from '../actions/route-tree-gen'
import {Props as ButtonProps} from '../common-adapters/button'
import openURL from '../util/open-url'
import * as Styles from '../styles'

type InfoIconProps = {
  invisible?: boolean
  onDocumentation: () => void
  onFeedback: () => void
  style?: Styles.StylesCrossPlatform
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
        {onClick: () => props.onFeedback(), title: 'Send feedback'},
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
  state => ({_loggedIn: state.config.loggedIn}),
  dispatch => ({
    _onFeedback: (loggedIn: boolean) => {
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [loggedIn ? 'signupSendFeedbackLoggedIn' : 'signupSendFeedbackLoggedOut'],
        })
      )
    },
    onDocumentation: () => openURL('https://keybase.io/docs'),
  }),
  (s, d, o: InfoIconOwnProps) => ({
    ...o,
    onDocumentation: d.onDocumentation,
    onFeedback: () => d._onFeedback(s._loggedIn),
  }),
  'SignupInfoIcon'
)(Kb.OverlayParentHOC(_InfoIcon))

type HeaderProps = {
  onBack?: (() => void) | null
  title?: string
  titleComponent?: React.ReactNode
  showInfoIcon: boolean
  showInfoIconRow: boolean
  style: Styles.StylesCrossPlatform
  negative: boolean
}

// Only used on desktop
const Header = (props: HeaderProps) => (
  <Kb.Box2
    direction="vertical"
    fullWidth={true}
    style={Styles.collapseStyles([styles.headerContainer, props.style])}
  >
    {(props.showInfoIcon || props.showInfoIconRow) && (
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.infoIconContainer}>
        <InfoIcon invisible={(props.negative as boolean) || (props.showInfoIconRow && !props.showInfoIcon)} />
      </Kb.Box2>
    )}
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
  waiting?: boolean
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
  onRightAction?: (() => void) | null
  leftAction?: 'back' | 'cancel'
  leftActionText?: string
  showHeaderInfoicon?: boolean
  showHeaderInfoiconRow?: boolean
}

// Screens with header + body bg color (i.e. all but join-or-login)
export const SignupScreen = (props: SignupScreenProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} alignItems="center">
    {!Styles.isMobile && (
      <Header
        onBack={props.onBack}
        title={props.title}
        titleComponent={props.titleComponent}
        showInfoIcon={!!props.showHeaderInfoicon}
        showInfoIconRow={!!props.showHeaderInfoiconRow}
        style={props.headerStyle || null}
        negative={!!props.negativeHeader}
      />
    )}
    {Styles.isMobile && !props.skipMobileHeader && (
      <Kb.HeaderHocHeader
        headerStyle={props.headerStyle}
        title={props.title}
        titleComponent={props.titleComponent}
        rightActionLabel={props.rightActionLabel}
        onRightAction={props.onRightAction}
        leftAction={props.leftAction}
        leftActionText={props.leftActionText}
        onBack={props.onBack}
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
SignupScreen.defaultProps = {
  leftAction: 'cancel',
  leftActionText: 'Back',
}

export const errorBanner = (error: string) =>
  error.trim()
    ? [
        <Kb.Banner key="generalError" color="red">
          <Kb.BannerParagraph bannerColor="red" content={error} />
        </Kb.Banner>,
      ]
    : []

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
  headerContainer: {
    backgroundColor: Styles.globalColors.white,
  },
  infoIconContainer: {
    justifyContent: 'flex-end',
    ...Styles.padding(Styles.globalMargins.small, Styles.globalMargins.small, 0),
  },
  opacityNone: {
    opacity: 0,
  },
  titleContainer: {
    ...Styles.padding(Styles.globalMargins.xsmall, 0, Styles.globalMargins.small),
    position: 'relative',
  },
})
