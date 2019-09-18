import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {SignupScreen} from '../../signup/common'
import * as Constants from '../../constants/autoreset'
import * as Container from '../../util/container'
import * as AutoresetGen from '../../actions/autoreset-gen'

type Props = {pipelineStarted: Boolean}

const todo = () => console.log('TODO')
const Waiting = (props: Props) => {
  const endTime = Container.useSelector(s => s.autoreset.endTime)
  const formattedTime = Constants.formatTimeLeft(endTime)

  const dispatch = Container.useDispatch()
  const onCancelReset = () => {
    dispatch(AutoresetGen.createCancelReset())
  }
  return (
    <SignupScreen
      title="Account reset"
      noBackground={true}
      buttons={[{label: 'Close', onClick: todo, type: 'Dim'}]}
    >
      <Kb.Box2 direction="vertical" gap="medium" fullWidth={true} fullHeight={true} centerChildren={true}>
        <Kb.Icon
          type={props.pipelineStarted ? 'iconfont-wave-2' : 'iconfont-mailbox'}
          color={Styles.globalColors.black}
          fontSize={24}
        />
        <Kb.Box2 direction="vertical" centerChildren={true} gap="small">
          <Kb.Text type="Header" center={true}>
            {props.pipelineStarted ? `Check back in ${formattedTime}` : 'Check your email or phone.'}
          </Kb.Text>
          {props.pipelineStarted ? (
            <Kb.Box2 direction="vertical" centerChildren={true}>
              <Kb.Text type="Body" style={styles.mainText} center={true}>
                The reset has been initiated. For security reasons, nothing will happen in the next 7 days. We
                will notify you once you can proceed with the reset.
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
              <Kb.Text type="BodyPrimaryLink" onClick={todo}>
                Send again
              </Kb.Text>
            </Kb.Box2>
          )}
        </Kb.Box2>
      </Kb.Box2>
    </SignupScreen>
  )
}
export default Waiting

const styles = Styles.styleSheetCreate(() => ({
  mainText: {
    ...Styles.padding(0, Styles.globalMargins.xsmall),
  },
}))
