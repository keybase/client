import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {SignupScreen} from '../../signup/common'
import HiddenString from '../../util/hidden-string'
import * as Container from '../../util/container'
import * as AutoresetGen from '../../actions/autoreset-gen'
import * as Constants from '../../constants/autoreset'

const EnterPassword = () => {
  const [password, setPassword] = React.useState('')

  const error = Container.useSelector(state => state.autoreset.error)
  const endTime = Container.useSelector(state => state.autoreset.endTime)
  const waiting = Container.useAnyWaiting(Constants.enterPipelineWaitingKey)

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onBack = React.useCallback(() => dispatch(nav.safeNavigateUpPayload()), [dispatch, nav])
  const onContinue = React.useCallback(
    () => dispatch(AutoresetGen.createResetAccount({password: new HiddenString(password)})),
    [dispatch, password]
  )

  // If we're here because the timer has run out, change the title.
  const title = endTime > 0 && Date.now() > endTime ? 'Almost done' : 'Your password'
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

const styles = Styles.styleSheetCreate(() => ({
  input: Styles.platformStyles({
    isElectron: {
      width: 368,
    },
  }),
  topGap: Styles.platformStyles({
    isMobile: {
      justifyContent: 'flex-start',
      marginTop: '20%',
    },
  }),
}))
export default EnterPassword
