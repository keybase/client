import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {SignupScreen} from '@/signup/common'
import {useConfigState} from '@/stores/config'
import {useSafeNavigation} from '@/util/safe-navigation'
import {enterResetPipeline} from './account-reset'

type Props = {route: {params: {username: string}}}

const EnterPassword = ({route}: Props) => {
  const {username} = route.params
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState('')
  const endTime = useConfigState(s => s.badgeState?.resetState.endTime ?? 0)
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyAutoresetEnterPipeline)
  const nav = useSafeNavigation()
  const onBack = () => nav.safeNavigateUp()

  const onContinue = () => {
    enterResetPipeline({onError: setError, password, username})
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
