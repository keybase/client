import * as C from '@/constants'
import * as AutoReset from '@/stores/autoreset'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {SignupScreen} from '@/signup/common'
import {useSafeNavigation} from '@/util/safe-navigation'

const EnterPassword = () => {
  const [password, setPassword] = React.useState('')
  const error = AutoReset.useAutoResetState(s => s.error)
  const endTime = AutoReset.useAutoResetState(s => s.endTime)
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyAutoresetEnterPipeline)
  const nav = useSafeNavigation()
  const onBack = React.useCallback(() => nav.safeNavigateUp(), [nav])

  const resetAccount = AutoReset.useAutoResetState(s => s.dispatch.resetAccount)
  const onContinue = React.useCallback(() => {
    resetAccount(password)
  }, [resetAccount, password])

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
        <Kb.LabeledInput
          placeholder="Enter your password"
          containerStyle={styles.input}
          type="password"
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
  topGap: Kb.Styles.platformStyles({
    isMobile: {
      justifyContent: 'flex-start',
      marginTop: '20%',
    },
  }),
}))
export default EnterPassword
