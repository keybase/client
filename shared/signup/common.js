// @flow
import * as React from 'react'
import * as Container from '../util/container'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'

type InfoIconProps = {|
  onDocumentation: () => void,
  onFeedback: () => void,
|}

const _InfoIcon = (props: Kb.PropsWithOverlay<InfoIconProps>) => (
  <>
    <Kb.Icon type="iconfont-info" onClick={props.toggleShowingMenu} ref={props.setAttachmentRef} />
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
      {props.onBack && <Kb.BackButton onClick={props.onBack} style={styles.backButton} />}
      <Kb.Text type="Header">{props.title}</Kb.Text>
    </Kb.Box2>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  backButton: {
    bottom: Styles.globalMargins.small,
    left: Styles.globalMargins.small,
    position: 'absolute',
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
