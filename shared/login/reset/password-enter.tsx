import * as C from '@/constants'
import * as AutoReset from '@/stores/autoreset'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {SignupScreen} from '@/signup/common'
import {useRouteNavigation} from '@/constants/router'

const EnterPassword = () => {
  const [password, setPassword] = React.useState('')
  const error = AutoReset.useAutoResetState(s => s.error)
  const endTime = AutoReset.useAutoResetState(s => s.endTime)
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyAutoresetEnterPipeline)
  const nav = useRouteNavigation()
  const onBack = () => nav.navigateUp()

  const resetAccount = AutoReset.useAutoResetState(s => s.dispatch.resetAccount)
  const onContinue = () => {
    resetAccount(password)
  }

  const [now] = React.useState(() => Date.now())

  // If we're here because the timer has run out, change the title.
  const title = endTime > 0 && now > endTime ? 'Almost done' : 'Your password'
  return (
    <SignupScreen
      title={title}
      onBack={onBack}
      banners={
        error ? (
          <Kb.Banner color="red">
            <Kb.BannerParagraph bannerColor="red" content={error} />
          </Kb.Banner>
        ) : null
      }
      buttons={[{label: 'Continue', onClick: onContinue, waiting}]}
    >
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.Input3
          placeholder="Enter your password"
          containerStyle={styles.input}
          secureTextEntry={true}
          onChangeText={setPassword}
          onEnterKeyDown={onContinue}
          autoFocus={true}
        />
      </Kb.Box2>
    </SignupScreen>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  input: Kb.Styles.platformStyles({
    isElectron: {
      width: 368,
    },
  }),
}))
export default EnterPassword
