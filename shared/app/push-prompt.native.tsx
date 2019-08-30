import * as React from 'react'
import * as Constants from '../constants/push'
import * as PushGen from '../actions/push-gen'
import * as Kb from '../common-adapters/mobile.native'
import * as Styles from '../styles'
import * as Container from '../util/container'
import HeaderHoc from '../common-adapters/header-hoc'
import {Props as HeaderHocProps} from '../common-adapters/header-hoc/types'

type OwnProps = {}

type Props = {
  onRequestPermissions: () => void
  onNoPermissions: () => void
}

const PushPrompt = (props: Props) => (
  <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} gap="small" style={styles.container}>
    <Kb.RequireImage
      resizeMode="stretch"
      style={styles.image}
      src={require('../images/illustrations/illustration-turn-on-notifications-460-x-252.png')}
    />
    <Kb.Text center={true} type="BodySemibold" negative={true}>
      Notifications are very important.
    </Kb.Text>
    <Kb.Text center={true} type="Body" negative={true}>
      Your phone might need to be contacted, for example if you install Keybase on another device. This is a
      crucial security setting.
    </Kb.Text>
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.buttonContainer}>
      <Kb.WaitingButton
        fullWidth={true}
        onClick={props.onRequestPermissions}
        label="Allow notifications"
        waitingKey={Constants.permissionsRequestingWaitingKey}
        style={styles.button}
        type="Success"
      />
    </Kb.Box2>
  </Kb.Box2>
)

const mapStateToProps = () => ({})
const mapDispatchToProps = dispatch => ({
  onNoPermissions: () => dispatch(PushGen.createRejectPermissions()),
  onRequestPermissions: () => dispatch(PushGen.createRequestPermissions()),
})

const PushPromptWithHeader = Container.withProps(
  (props: Props & HeaderHocProps & ReturnType<typeof mapDispatchToProps>): Partial<HeaderHocProps> => ({
    borderless: true,
    customComponent: (
      <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={true} style={styles.header}>
        <Kb.Text type="BodyBig" negative={true}>
          Allow notifications
        </Kb.Text>
        <Kb.ClickableBox onClick={props.onNoPermissions} style={styles.skip}>
          <Kb.Text type="BodyBig" negative={true}>
            Skip
          </Kb.Text>
        </Kb.ClickableBox>
      </Kb.Box2>
    ),
    onRightAction: props.onNoPermissions,
    rightActionLabel: 'Skip',
  })
)(HeaderHoc(PushPrompt))

// TODO: uncomment when we make this a routed component
// PushPrompt.navigationOptions = {
//   header: null,
//   headerTitle: 'Allow notifications',
//   headerBottomStyle: {height: undefined},
//   headerLeft: null, // no back button
//   headerRightActions: () => (
//     <Kb.Box2
//       direction="horizontal"
//       style={Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.tiny, 0)}
//     >
//       <Text type="BodyBig" negative={true}>
//         Skip
//       </Text>
//     </Kb.Box2>
//   ),
// }

const styles = Styles.styleSheetCreate(() => ({
  button: {maxHeight: 40},
  buttonContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  container: {
    ...Styles.globalStyles.fillAbsolute,
    backgroundColor: Styles.globalColors.blue,
    padding: Styles.globalMargins.small,
  },
  header: {
    backgroundColor: Styles.globalColors.blue,
    height: '100%',
    position: 'relative',
  },
  image: {
    height: '55%',
    width: '155%',
  },
  skip: {
    position: 'absolute',
    right: Styles.globalMargins.small,
  },
}))

export default Container.compose(
  Container.namedConnect(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o: OwnProps) => ({...o, ...s, ...d}),
    'PushPrompt'
  ),
  Container.safeSubmitPerMount(['onRequestPermissions', 'onNoPermissions'])
  // @ts-ignore
)(PushPromptWithHeader)
