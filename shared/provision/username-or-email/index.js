// @flow
// TODO remove Container
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import Container from '../../login/forms/container'
import * as Constants from '../../constants/provision'
import {RPCError} from '../../util/errors'
import {constantsStatusCode} from '../../constants/types/rpc-gen'

type Props = {
  error: string,
  inlineError: ?RPCError,
  onSubmit: (usernameOrEmail: string) => void,
  onBack: () => void,
  submittedUsernameOrEmail: string,
  usernameOrEmail: string,
  setUsernameOrEmail: (text: string) => void,
}

const InlineError = (props: {inlineError: RPCError}) => {
  console.warn('in inlineError', props.inlineError, props.inlineError.desc)
  return props.inlineError.code === constantsStatusCode.scnotfound ? (
    <Kb.Box2 direction="horizontal">
      <Kb.Text type="BodySmallError">
        The username or email you provided doesn't exist on Keybase. Would you like to
      </Kb.Text>
      <Kb.Text type="BodySmallPrimaryLink">sign up for a new account?</Kb.Text>
    </Kb.Box2>
  ) : (
    <Kb.Text type="BodySmallError" style={{color: Styles.globalColors.red}}>
      {props.inlineError.desc}
    </Kb.Text>
  )
}

const UsernameOrEmail = (props: Props) => (
  <Container style={styles.container} outerStyle={styles.outerStyle} onBack={() => props.onBack()}>
    <Kb.UserCard style={styles.card} outerStyle={styles.outerCard}>
      <Kb.Input
        autoFocus={true}
        style={styles.input}
        hintText="Username or email"
        errorText={props.submittedUsernameOrEmail === props.usernameOrEmail ? props.error : ''}
        onEnterKeyDown={() => props.onSubmit(props.usernameOrEmail)}
        onChangeText={text => props.setUsernameOrEmail(text)}
        value={props.usernameOrEmail}
      />
      {props.inlineError && <InlineError inlineError={props.inlineError} />}
      <Kb.WaitingButton
        label="Continue"
        type="Primary"
        style={styles.button}
        onClick={() => props.onSubmit(props.usernameOrEmail)}
        disabled={!props.usernameOrEmail}
        waitingKey={Constants.waitingKey}
      />
    </Kb.UserCard>
  </Container>
)

const styles = Styles.styleSheetCreate({
  button: Styles.platformStyles({
    common: {
      alignSelf: 'center',
    },
    isElectron: {
      marginTop: Styles.globalMargins.medium,
    },
  }),
  card: {
    alignItems: 'stretch',
  },
  container: Styles.platformStyles({
    common: {
      flex: 1,
    },
    isElectron: {
      alignItems: 'center',
      justifyContent: 'center',
    },
  }),
  input: Styles.platformStyles({
    isMobile: {
      flexGrow: 1,
      marginBottom: Styles.globalMargins.small,
    },
  }),
  outerCard: {
    marginTop: 40,
  },
  outerStyle: {
    backgroundColor: Styles.globalColors.white,
  },
})

export default UsernameOrEmail
