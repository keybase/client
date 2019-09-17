import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {SignupScreen} from '../../signup/common'

type Props =
  | {
      hasPW: false
    }
  | {
      hasPW: true
      time: string
    }
const todo = () => console.log('TODO')
const Waiting = (props: Props) => (
  <SignupScreen
    title="Account reset"
    noBackground={true}
    buttons={[{label: 'Close', onClick: todo, type: 'Dim'}]}
  >
    <Kb.Box2 direction="vertical" gap="medium" fullWidth={true} fullHeight={true} centerChildren={true}>
      <Kb.Icon
        type={props.hasPW ? 'iconfont-wave-2' : 'iconfont-mailbox'}
        color={Styles.globalColors.black}
        fontSize={24}
      />
      <Kb.Box2 direction="vertical" centerChildren={true} gap="small">
        <Kb.Text type="Header" center={true}>
          {props.hasPW ? `Check back in ${props.time}` : 'Check your email or phone.'}
        </Kb.Text>
        {props.hasPW ? (
          <Kb.Box2 direction="vertical" centerChildren={true}>
            <Kb.Text type="Body" style={styles.mainText}>
              The reset has been initiated. For security reasons, nothing will happen in the next 7 days. We
              will notify you once you can proceed with the reset.
            </Kb.Text>
            <Kb.Text type="Body">Unless you would like to</Kb.Text>
            <Kb.Text type="BodyPrimaryLink" onClick={todo}>
              cancel the reset.
            </Kb.Text>
          </Kb.Box2>
        ) : (
          <Kb.Box2 direction="vertical" centerChildren={true}>
            <Kb.Text type="Body" style={styles.mainText}>
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
export default Waiting

const styles = Styles.styleSheetCreate(() => ({
  mainText: {
    ...Styles.padding(0, Styles.globalMargins.xsmall),
    textAlign: 'center',
  },
}))
