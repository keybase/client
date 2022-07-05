import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {SignupScreen} from '../../signup/common'
import HiddenString from '../../util/hidden-string'
import * as Container from '../../util/container'
import * as AutoresetGen from '../../actions/autoreset-gen'
import * as Constants from '../../constants/autoreset'

const KnowPassword = () => {
  const error = Container.useSelector(state => state.autoreset.error)
  const waiting = Container.useAnyWaiting(Constants.enterPipelineWaitingKey)

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onCancel = React.useCallback(() => dispatch(nav.safeNavigateUpPayload()), [nav, dispatch])
  const onYes = React.useCallback(
    () => dispatch(nav.safeNavigateAppendPayload({path: ['resetEnterPassword']})),
    [dispatch, nav]
  )
  const onNo = React.useCallback(() => dispatch(AutoresetGen.createResetAccount({})), [dispatch])
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
      <Kb.Box2
        direction="vertical"
        gap="medium"
        fullWidth={true}
        fullHeight={true}
        centerChildren={true}
        style={styles.topGap}
      >
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

KnowPassword.navigationOptions = {
  header: null,
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
}
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
  topGap: Styles.platformStyles({
    isMobile: {
      justifyContent: 'flex-start',
      marginTop: '20%',
    },
  }),
}))

export {EnterPassword, KnowPassword}
