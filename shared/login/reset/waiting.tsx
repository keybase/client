import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {SignupScreen} from '../../signup/common'
import * as Constants from '../../constants/autoreset'
import * as Container from '../../util/container'
import * as AutoresetGen from '../../actions/autoreset-gen'

// TODO: figure out how send again works
const todo = () => console.log('TODO')

type Props = Container.RouteProps<{pipelineStarted: boolean}>

const Waiting = (props: Props) => {
  const pipelineStarted = Container.getRouteProps(props, 'pipelineStarted', false)
  const endTime = Container.useSelector(state => state.autoreset.endTime)
  const formattedTime = Constants.formatTimeLeft(endTime)

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  const onCancelReset = React.useCallback(() => dispatch(AutoresetGen.createCancelReset()), [])
  const onClose = React.useCallback(
    () => dispatch(nav.safeNavigateAppendPayload({path: ['login'], replace: true})),
    []
  )
  const onSendAgain = todo

  return (
    <SignupScreen
      title="Account reset"
      noBackground={true}
      buttons={[{label: 'Close', onClick: onClose, type: 'Dim'}]}
    >
      <Kb.Box2 direction="vertical" gap="medium" fullWidth={true} fullHeight={true} centerChildren={true}>
        <Kb.Icon
          type={pipelineStarted ? 'iconfont-wave-2' : 'iconfont-mailbox'}
          color={Styles.globalColors.black}
          fontSize={24}
        />
        <Kb.Box2 direction="vertical" centerChildren={true} gap="small">
          <Kb.Text type="Header" center={true}>
            {pipelineStarted ? `Check back in ${formattedTime}` : 'Check your email or phone.'}
          </Kb.Text>
          {pipelineStarted ? (
            <Kb.Box2 direction="vertical" centerChildren={true}>
              <Kb.Text type="Body" style={styles.mainText} center={true}>
                The reset has been initiated. For security reasons, nothing will happen in the next{' '}
                {formattedTime}. We will notify you once you can proceed with the reset.
              </Kb.Text>
              <Kb.Text type="Body">Unless you would like to</Kb.Text>
              <Kb.Text type="BodyPrimaryLink" onClick={onCancelReset}>
                cancel the reset.
              </Kb.Text>
            </Kb.Box2>
          ) : (
            <Kb.Box2 direction="vertical" centerChildren={true}>
              <Kb.Text type="Body" style={styles.mainText} center={true}>
                We are sending instructions to your email address or phone number.
              </Kb.Text>
              <Kb.Text type="BodyPrimaryLink" onClick={onSendAgain}>
                Send again
              </Kb.Text>
            </Kb.Box2>
          )}
        </Kb.Box2>
      </Kb.Box2>
    </SignupScreen>
  )
}

Waiting.navigationOptions = {
  header: null,
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
}

export default Waiting

const styles = Styles.styleSheetCreate(() => ({
  mainText: {
    ...Styles.padding(0, Styles.globalMargins.xsmall),
    maxWidth: 300,
  },
}))
