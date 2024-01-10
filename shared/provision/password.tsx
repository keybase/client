import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import UserCard from '../login/user-card'
import {SignupScreen, errorBanner} from '../signup/common'
import {isMobile} from '@/constants/platform'

const Container = () => {
  const error = C.useProvisionState(s => s.error)
  const resetEmailSent = C.useRecoverState(s => s.resetEmailSent)
  const username = C.useProvisionState(s => s.username)
  const waiting = C.Waiting.useAnyWaiting(C.Provision.waitingKey)
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const startRecoverPassword = C.useRecoverState(s => s.dispatch.startRecoverPassword)
  const _onForgotPassword = (username: string) => {
    startRecoverPassword({abortProvisioning: true, username})
  }
  const onBack = () => {
    navigateUp()
  }
  const onSubmit = C.useProvisionState(s => s.dispatch.dynamic.setPassphrase)
  const props = {
    error,
    onBack,
    onForgotPassword: () => _onForgotPassword(username),
    onSubmit: (password: string) => !waiting && onSubmit?.(password),
    resetEmailSent,
    username,
    waiting,
  }
  return <Password {...props} />
}

export type Props = {
  onSubmit: (password: string) => void
  onBack: () => void
  onForgotPassword: () => void
  waiting: boolean
  error: string
  username?: string
  resetEmailSent?: boolean
}

const Password = (props: Props) => {
  const [password, setPassword] = React.useState('')
  const {onSubmit} = props
  const _onSubmit = React.useCallback(() => onSubmit(password), [password, onSubmit])
  const resetState = C.useRecoverState(s => s.dispatch.resetState)
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
          {props.resetEmailSent ? (
            <Kb.Banner color="green" key="resetBanner">
              <Kb.BannerParagraph
                bannerColor="green"
                content="We've sent you an email with password reset instructions."
              />
            </Kb.Banner>
          ) : null}
          {errorBanner(props.error)}
        </>
      }
      buttons={[
        {
          disabled: !password,
          label: 'Continue',
          onClick: _onSubmit,
          type: 'Default',
          waiting: props.waiting,
        },
      ]}
      onBack={props.onBack}
      title={isMobile ? 'Enter password' : 'Enter your password'}
      contentContainerStyle={styles.contentContainer}
    >
      <Kb.ScrollView
        alwaysBounceVertical={false}
        style={styles.fill}
        contentContainerStyle={styles.scrollContentContainer}
      >
        <UserCard
          style={styles.card}
          username={props.username}
          avatarBackgroundStyle={styles.outerCardAvatar}
          outerStyle={styles.outerCard}
          lighterPlaceholders={true}
          avatarSize={96}
        >
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.wrapper} gap="xsmall">
            <Kb.LabeledInput
              autoFocus={true}
              placeholder="Password"
              onEnterKeyDown={_onSubmit}
              onChangeText={setPassword}
              value={password}
              textType="BodySemibold"
              type="password"
            />
            <Kb.Text
              style={styles.forgotPassword}
              type="BodySmallSecondaryLink"
              onClick={props.onForgotPassword}
            >
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

export default Container
