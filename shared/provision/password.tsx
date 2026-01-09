import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import UserCard from '../login/user-card'
import {SignupScreen, errorBanner} from '../signup/common'
import {useState as useRecoverState} from '@/stores/recover-password'
import {useProvisionState} from '@/stores/provision'

const Password = () => {
  const error = useProvisionState(s => s.error)
  const resetEmailSent = useRecoverState(s => s.resetEmailSent)
  const username = useProvisionState(s => s.username)
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyProvision)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const startRecoverPassword = useRecoverState(s => s.dispatch.startRecoverPassword)
  const _onForgotPassword = () => {
    startRecoverPassword({abortProvisioning: true, username})
  }
  const onBack = () => {
    navigateUp()
  }
  const _onSubmit = useProvisionState(s => s.dispatch.dynamic.setPassphrase)
  const onSubmit = React.useCallback(
    (password: string) => !waiting && _onSubmit?.(password),
    [_onSubmit, waiting]
  )
  const [password, setPassword] = React.useState('')
  const _onSubmitClick = React.useCallback(() => onSubmit(password), [password, onSubmit])
  const resetState = useRecoverState(s => s.dispatch.resetState)
  React.useEffect(
    () => () => {
      resetState()
    },
    [resetState]
  )

  return (
    <SignupScreen
      banners={
        <>
          {resetEmailSent ? (
            <Kb.Banner color="green" key="resetBanner">
              <Kb.BannerParagraph
                bannerColor="green"
                content="We've sent you an email with password reset instructions."
              />
            </Kb.Banner>
          ) : null}
          {errorBanner(error)}
        </>
      }
      buttons={[
        {
          disabled: !password,
          label: 'Continue',
          onClick: _onSubmitClick,
          type: 'Default',
          waiting,
        },
      ]}
      onBack={onBack}
      title={C.isMobile ? 'Enter password' : 'Enter your password'}
      contentContainerStyle={styles.contentContainer}
    >
      <Kb.ScrollView
        alwaysBounceVertical={false}
        style={styles.fill}
        contentContainerStyle={styles.scrollContentContainer}
      >
        <UserCard
          style={styles.card}
          username={username}
          avatarBackgroundStyle={styles.outerCardAvatar}
          outerStyle={styles.outerCard}
          lighterPlaceholders={true}
          avatarSize={96}
        >
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.wrapper} gap="xsmall">
            <Kb.LabeledInput
              autoFocus={true}
              placeholder="Password"
              onEnterKeyDown={_onSubmitClick}
              onChangeText={setPassword}
              value={password}
              textType="BodySemibold"
              type="password"
            />
            <Kb.Text style={styles.forgotPassword} type="BodySmallSecondaryLink" onClick={_onForgotPassword}>
              Forgot password?
            </Kb.Text>
          </Kb.Box2>
        </UserCard>
      </Kb.ScrollView>
    </SignupScreen>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  card: Kb.Styles.platformStyles({
    common: {
      alignItems: 'stretch',
      backgroundColor: Kb.Styles.globalColors.transparent,
    },
    isMobile: {
      paddingLeft: 0,
      paddingRight: 0,
    },
  }),
  contentContainer: Kb.Styles.platformStyles({isMobile: {...Kb.Styles.padding(0)}}),
  fill: Kb.Styles.platformStyles({
    isMobile: {height: '100%', width: '100%'},
    isTablet: {width: 410},
  }),
  forgotPassword: {
    alignSelf: 'flex-end',
  },
  outerCard: Kb.Styles.platformStyles({
    common: {flex: 1},
    isElectron: {height: 'unset'},
  }),
  outerCardAvatar: {
    backgroundColor: Kb.Styles.globalColors.transparent,
  },
  scrollContentContainer: Kb.Styles.platformStyles({
    isElectron: {
      margin: 'auto',
    },
    isMobile: {...Kb.Styles.padding(Kb.Styles.globalMargins.small)},
  }),
  wrapper: Kb.Styles.platformStyles({
    isElectron: {
      width: 400,
    },
    isMobile: {
      width: '100%',
    },
  }),
}))

export default Password
