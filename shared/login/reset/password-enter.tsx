import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {SignupScreen, errorBanner} from '@/signup/common'
import {enterResetPipeline} from './account-reset'

type Props = {route: {params: {username: string}}}

const EnterPassword = ({route}: Props) => {
  const styles = useStyles()
  const {username} = route.params
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState('')
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyAutoresetEnterPipeline)

  const onContinue = () => {
    enterResetPipeline({onError: setError, password, username})
  }

  return (
    <SignupScreen
      banners={errorBanner(error)}
      buttons={[{label: 'Continue', onClick: onContinue, waiting}]}
    >
      <Kb.Input3
        textType="BodySemibold"
        placeholder="Enter your password"
        containerStyle={styles.input}
        secureTextEntry={true}
        onChangeText={setPassword}
        onEnterKeyDown={onContinue}
        autoFocus={true}
      />
    </SignupScreen>
  )
}

const useStyles = Kb.Styles.createStyleHook(() => ({
  input: Kb.Styles.platformStyles({
    isElectron: {
      width: 368,
    },
  }),
}))
export default EnterPassword
