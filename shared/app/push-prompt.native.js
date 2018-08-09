// @flow
import * as React from 'react'
import * as Constants from '../constants/push'
import * as PushGen from '../actions/push-gen'
import * as Kb from '../common-adapters/mobile.native'
import * as Styles from '../styles'
import * as Container from '../util/container'

type Props = {
  onRequestPermissions: () => void,
  onNoPermissions: () => void,
}

const PushPrompt = (props: Props) => (
  <Kb.ScrollView>
    <Kb.Box2 direction="vertical" fullWidth={true} gap="small" style={styles.container}>
      <Kb.Text type="Header" style={styles.text}>
        Please turn on notifications!
      </Kb.Text>
      <Kb.RequireImage
        style={styles.image}
        src={require('../images/illustrations/illustration-turn-on-notifications-460-x-252.png')}
      />
      <Kb.Text type="BodySmallSemibold" style={styles.text}>
        It's{' '}
        <Kb.Text type="BodySmallSemiboldItalic" style={{color: Styles.globalColors.black}}>
          very
        </Kb.Text>{' '}
        important you enable notifications.
      </Kb.Text>
      <Kb.Text type="BodySmall" style={styles.text}>
        This phone may need to perform crypto for you, which the Keybase servers cannot do. For example, if
        you provision a new device, this phone will be contacted.
      </Kb.Text>
      <Kb.WaitingButton
        type="Primary"
        fullWidth={true}
        onClick={props.onRequestPermissions}
        label="Got it"
        waitingKey={Constants.permissionsRequestingWaitingKey}
      />
      <Kb.Button type="Secondary" fullWidth={true} onClick={props.onNoPermissions} label="No thanks" />
    </Kb.Box2>
  </Kb.ScrollView>
)

const styles = Styles.styleSheetCreate({
  container: {padding: Styles.globalMargins.small},
  image: Styles.platformStyles({
    isMobile: {
      height: 200,
      resizeMode: 'contain',
      width: '170%',
    },
  }),
  text: {
    color: Styles.globalColors.black,
    textAlign: 'center',
  },
})

const mapStateToProps = () => ({})
const mapDispatchToProps = (dispatch: Container.Dispatch) => ({
  onNoPermissions: () => dispatch(PushGen.createRejectPermissions()),
  onRequestPermissions: () => dispatch(PushGen.createRequestPermissions()),
})

export default Container.compose(
  Container.connect(mapStateToProps, mapDispatchToProps),
  Container.setDisplayName('PushPrompt'),
  Container.safeSubmitPerMount(['onRequestPermissions', 'onNoPermissions'])
)(PushPrompt)
