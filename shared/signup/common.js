// @flow
import * as React from 'react'
import * as Container from '../util/container'
import * as Kb from '../common-adapters'
import type {Props as ButtonProps} from '../common-adapters/button'
import * as Styles from '../styles'

type InfoIconProps = {|
  onDocumentation: () => void,
  onFeedback: () => void,
|}

const _InfoIcon = (props: Kb.PropsWithOverlay<InfoIconProps>) => (
  <>
    <Kb.Icon type="iconfont-question-mark" onClick={props.toggleShowingMenu} ref={props.setAttachmentRef} />
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
export const InfoIcon = Container.compose(
  Container.namedConnect<{}, _, _, _, _>(
    () => ({}),
    () => ({onDocumentation: () => {}, onFeedback: () => {}}),
    (s, d, o) => ({...o, ...s, ...d}),
    'SignupInfoIcon'
  ),
  Kb.OverlayParentHOC
)(_InfoIcon)

type HeaderProps = {|
  onBack?: () => void,
  title: string,
|}

// Only used on desktop
export const Header = (props: HeaderProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.infoIconContainer}>
      <InfoIcon />
    </Kb.Box2>
    <Kb.Box2 direction="horizontal" centerChildren={true} style={styles.titleContainer} fullWidth={true}>
      {props.onBack && (
        <Kb.ClickableBox onClick={props.onBack} style={styles.backButton}>
          <Kb.Box2 direction="horizontal" alignItems="center" gap="xtiny">
            <Kb.Icon
              type="iconfont-arrow-left"
              color={Styles.globalColors.black_50}
              sizeType="Small"
              style={styles.fixIconAlignment}
            />
            <Kb.Text type="Body" style={styles.backText}>
              Back
            </Kb.Text>
          </Kb.Box2>
        </Kb.ClickableBox>
      )}
      <Kb.Text type="Header">{props.title}</Kb.Text>
    </Kb.Box2>
  </Kb.Box2>
)

type ButtonMeta = {|
  disabled?: boolean,
  label: string,
  onClick: () => void,
  type: $PropertyType<ButtonProps, 'type'>,
|}
type SignupScreenProps = {|
  banners?: React.Node,
  buttons: Array<ButtonMeta>,
  children: React.Node,
  onBack?: () => void,
  title: string,

  // HACK - HeaderHoc isn't typed to add props correctly (and we're only using it conditionally here)
  // add props from HeaderHoc as necessary
  // Mobile only
  rightActionLabel?: string,
  onRightAction?: ?() => void,
  leftAction?: 'back' | 'cancel',
  leftActionText?: string,
|}

// Screens with header + body bg color (i.e. all but join-or-login)
const _SignupScreen = (props: SignupScreenProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} alignItems="center">
    {!Styles.isMobile && <Header onBack={props.onBack} title={props.title} />}
    <Kb.Box2 alignItems="center" direction="vertical" style={styles.blueBackground} fullWidth={true}>
      <Kb.Box2 alignItems="center" direction="vertical" style={styles.body} fullWidth={true}>
        {props.children}
      </Kb.Box2>
      {/* Banners after children so they go on top */}
      {!!props.banners && <Kb.Box2 direction="vertical" style={styles.banners} children={props.banners} />}
      <Kb.ButtonBar direction="column" fullWidth={Styles.isMobile} style={styles.buttonBar}>
        {props.buttons.map(b => (
          <Kb.Button key={b.label} style={styles.button} {...b} />
        ))}
      </Kb.ButtonBar>
    </Kb.Box2>
  </Kb.Box2>
)
export const SignupScreen = Styles.isMobile ? Kb.HeaderHoc(_SignupScreen) : _SignupScreen
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
  infoIconContainer: {
    justifyContent: 'flex-end',
    ...Styles.padding(Styles.globalMargins.small, Styles.globalMargins.small, 0),
  },
  titleContainer: {
    ...Styles.padding(Styles.globalMargins.xsmall, 0, Styles.globalMargins.small),
    position: 'relative',
  },
})
