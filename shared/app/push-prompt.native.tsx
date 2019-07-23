import * as React from 'react'
import * as Constants from '../constants/push'
import * as PushGen from '../actions/push-gen'
import * as Kb from '../common-adapters/mobile.native'
import * as Styles from '../styles'
import * as Container from '../util/container'

type OwnProps = {}

type Props = {
  onRequestPermissions: () => void
  onNoPermissions: () => void
}

const PushPrompt = (props: Props) => (
  <Kb.ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
    <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} gap="small" style={styles.container}>
      <Kb.Box style={styles.spacer} />
      <Kb.Text center={true} type="Header" style={styles.text}>
        Please turn on notifications!
      </Kb.Text>
      <Kb.RequireImage
        resizeMode="contain"
        style={styles.image}
        src={require('../images/illustrations/illustration-turn-on-notifications-460-x-252.png')}
      />
      <Kb.Text center={true} type="BodySmallSemibold" style={styles.text}>
        It's{' '}
        <Kb.Text center={true} type="BodySmallSemiboldItalic" style={styles.text}>
          very
        </Kb.Text>{' '}
        important you enable notifications.
      </Kb.Text>
      <Kb.Text center={true} type="BodySmall" style={styles.text}>
        This phone may need to perform crypto for you, which the Keybase servers cannot do. For example, if
        you provision a new device, this phone will be contacted.
      </Kb.Text>
      <Kb.WaitingButton
        fullWidth={true}
        onClick={props.onRequestPermissions}
        label="Got it"
        waitingKey={Constants.permissionsRequestingWaitingKey}
        style={styles.button}
      />
      <Kb.Button
        type="Dim"
        fullWidth={true}
        onClick={props.onNoPermissions}
        label="No thanks"
        style={styles.button}
      />
      <Kb.Box style={styles.spacer} />
    </Kb.Box2>
  </Kb.ScrollView>
)

const styles = Styles.styleSheetCreate({
  button: {maxHeight: 40},
  container: {padding: Styles.globalMargins.small},
  image: Styles.platformStyles({
    isMobile: {
      height: 200,
      width: '170%',
    },
  }),
  scroll: {
    backgroundColor: Styles.globalColors.white,
    ...Styles.globalStyles.fillAbsolute,
  },
  scrollContent: {minHeight: '100%'},
  spacer: {flexGrow: 1},
  text: {
    color: Styles.globalColors.black,
  },
})

const mapStateToProps = () => ({})
const mapDispatchToProps = dispatch => ({
  onNoPermissions: () => dispatch(PushGen.createRejectPermissions()),
  onRequestPermissions: () => dispatch(PushGen.createRequestPermissions()),
})

export default Container.compose(
  Container.namedConnect(
    mapStateToProps,
    mapDispatchToProps,
    (s, d, o: OwnProps) => ({...o, ...s, ...d}),
    'PushPrompt'
  ),
  Container.safeSubmitPerMount(['onRequestPermissions', 'onNoPermissions'])
  // @ts-ignore
)(PushPrompt)
