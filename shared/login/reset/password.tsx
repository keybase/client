import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {SignupScreen} from '../../signup/common'
import HiddenString from '../../util/hidden-string'
import * as Container from '../../util/container'
import * as AutoresetGen from '../../actions/autoreset-gen'
import * as Constants from '../../constants/autoreset'
import {useWaiting} from '../../constants/waiting'

const KnowPassword = () => {
  const error = Container.useSelector(state => state.autoreset.error)
  const waiting = useWaiting(Constants.autoresetEnterPipelineWaitingKey)

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onCancel = React.useCallback(() => dispatch(nav.safeNavigateUpPayload()), [])
  const onYes = React.useCallback(
    () => dispatch(nav.safeNavigateAppendPayload({path: ['resetEnterPassword']})),
    []
  )
  const onNo = React.useCallback(() => dispatch(AutoresetGen.createResetAccount({})), [])
  return (
    <SignupScreen
      title="Account reset"
      noBackground={true}
      onBack={onCancel}
      leftActionText="Cancel"
      banners={
        error ? (
          <Kb.Banner color="red">
            <Kb.BannerParagraph bannerColor="red" content={error} />
          </Kb.Banner>
        ) : null
      }
      buttons={[
        {label: 'Yes', onClick: onYes, type: 'Success'},
        {label: 'No', onClick: onNo, type: 'Dim', waiting},
      ]}
    >
      <Kb.Box2 direction="vertical" gap="medium" fullWidth={true} fullHeight={true} centerChildren={true}>
        <Kb.Icon type="iconfont-password" color={Styles.globalColors.black} fontSize={24} />
        <Kb.Box2 direction="vertical" centerChildren={true}>
          <Kb.Text type="Header" center={true}>
            Do you know your
          </Kb.Text>
          <Kb.Text type="Header" center={true}>
            password?
          </Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    </SignupScreen>
  )
}

const EnterPassword = () => {
  const [password, setPassword] = React.useState('')

  const error = Container.useSelector(state => state.autoreset.error)
  const waiting = useWaiting(Constants.autoresetEnterPipelineWaitingKey)

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onBack = React.useCallback(() => dispatch(nav.safeNavigateUpPayload()), [])
  const onContinue = React.useCallback(
    () => dispatch(AutoresetGen.createResetAccount({password: new HiddenString(password)})),
    [password]
  )
  return (
    <SignupScreen
      title="Your password"
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
        />
      </Kb.Box2>
    </SignupScreen>
  )
}

// @ts-ignore
KnowPassword.navigationOptions = {
  header: null,
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
}
// @ts-ignore
EnterPassword.navigationOptions = {
  header: null,
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
}

const styles = Styles.styleSheetCreate(() => ({
  input: Styles.platformStyles({
    isElectron: {
      width: 368,
    },
  }),
}))

export {EnterPassword, KnowPassword}
