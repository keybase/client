import * as C from '@/constants'
import * as AutoReset from '@/constants/autoreset'
import {useSignupState} from '@/constants/signup'
import {useSafeSubmit} from '@/util/safe-submit'
import * as T from '@/constants/types'
import * as React from 'react'
import type {RPCError} from '@/util/errors'
import * as Kb from '@/common-adapters'
import UserCard from '@/login/user-card'
import {SignupScreen, errorBanner} from '@/signup/common'
import {useProvisionState} from '@/constants/provision'

type OwnProps = {fromReset?: boolean}

const decodeInlineError = (inlineRPCError: RPCError | undefined) => {
  let inlineError = ''
  let inlineSignUpLink = false
  if (inlineRPCError) {
    switch (inlineRPCError.code) {
      case T.RPCGen.StatusCode.scnotfound:
        // If it's a "not found" error, we will show "go to signup" link,
        // otherwise just the error.
        inlineError = ''
        inlineSignUpLink = true
        break
      case T.RPCGen.StatusCode.scbadusername:
        inlineError = C.usernameHint
        inlineSignUpLink = false
        break
      default:
    }
  }
  return {inlineError, inlineSignUpLink}
}

const UsernameOrEmailContainer = (op: OwnProps) => {
  const _resetBannerUser = AutoReset.useAutoResetState(s => s.username)
  const resetBannerUser = op.fromReset ? _resetBannerUser : undefined
  const _error = useProvisionState(s => s.error)
  const {inlineError, inlineSignUpLink} = useProvisionState(
    C.useShallow(s => decodeInlineError(s.inlineError))
  )
  const error = _error ? _error : inlineError && !inlineSignUpLink ? inlineError : ''
  // So we can clear the error if the name is changed
  const _username = useProvisionState(s => s.username)
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyProvision)
  const hasError = !!error || !!inlineError || inlineSignUpLink

  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = useSafeSubmit(navigateUp, hasError)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onForgotUsername = React.useCallback(() => navigateAppend('forgotUsername'), [navigateAppend])
  const requestAutoInvite = useSignupState(s => s.dispatch.requestAutoInvite)
  const _onGoToSignup = requestAutoInvite
  const _setUsername = useProvisionState(s => s.dispatch.dynamic.setUsername)
  const _onSubmit = React.useCallback(
    (username: string) => {
      !waiting && _setUsername?.(username)
    },
    [_setUsername, waiting]
  )
  const [username, setUsername] = React.useState(_username)
  const onSubmit = React.useCallback(() => {
    _onSubmit(username)
  }, [_onSubmit, username])
  const onGoToSignup = React.useCallback(() => {
    _onGoToSignup(username)
  }, [_onGoToSignup, username])

  return (
    <SignupScreen
      onRightAction={onGoToSignup}
      rightActionLabel="Create account"
      banners={
        <>
          {resetBannerUser ? (
            <Kb.Banner color="green" key="resetBanner">
              <Kb.BannerParagraph
                bannerColor="green"
                content={`You have successfully reset your account, ${resetBannerUser}. You can now log in as usual.`}
              />
            </Kb.Banner>
          ) : null}
          {errorBanner(error)}
          {inlineSignUpLink ? (
            <Kb.Banner key="usernameTaken" color="blue">
              <Kb.BannerParagraph
                bannerColor="blue"
                content={[
                  "This username doesn't exist. Did you mean to ",
                  {
                    onClick: onGoToSignup,
                    text: 'create a new account',
                  },
                  '?',
                ]}
              />
            </Kb.Banner>
          ) : null}
        </>
      }
      buttons={[
        {
          disabled: !username,
          label: 'Log in',
          onClick: onSubmit,
          type: 'Default',
          waiting: waiting,
        },
      ]}
      onBack={onBack}
      title="Log in"
      contentContainerStyle={styles.contentContainer}
    >
      <Kb.ScrollView
        alwaysBounceVertical={false}
        style={styles.fill}
        contentContainerStyle={styles.scrollContentContainer}
      >
        <UserCard
          style={styles.card}
          avatarBackgroundStyle={styles.outerCardAvatar}
          outerStyle={styles.outerCard}
          lighterPlaceholders={true}
          avatarSize={96}
        >
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.wrapper} gap="xsmall">
            <Kb.LabeledInput
              autoFocus={true}
              placeholder="Username"
              maxLength={C.maxUsernameLength}
              onEnterKeyDown={onSubmit}
              onChangeText={setUsername}
              value={username}
              textType="BodySemibold"
              placeholderInline={true}
            />
            <Kb.Text style={styles.forgotUsername} type="BodySmallSecondaryLink" onClick={onForgotUsername}>
              Forgot username?
            </Kb.Text>
          </Kb.Box2>
        </UserCard>
      </Kb.ScrollView>
    </SignupScreen>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      card: Kb.Styles.platformStyles({
        common: {
          alignItems: 'stretch',
          backgroundColor: Kb.Styles.globalColors.transparent,
        },
        isMobile: {
          paddingLeft: 0,
          paddingRight: 0,
        },
        isTablet: {alignItems: 'center'},
      }),
      contentContainer: Kb.Styles.platformStyles({isMobile: {...Kb.Styles.padding(0)}}),
      fill: Kb.Styles.platformStyles({
        isMobile: {height: '100%', width: '100%'},
        isTablet: {width: 410},
      }),
      forgotUsername: {alignSelf: 'flex-end'},
      outerCard: Kb.Styles.platformStyles({
        common: {flex: 1},
        isElectron: {height: 'unset'},
      }),
      outerCardAvatar: {backgroundColor: Kb.Styles.globalColors.transparent},
      scrollContentContainer: Kb.Styles.platformStyles({
        isElectron: {margin: 'auto'},
        isMobile: {...Kb.Styles.padding(Kb.Styles.globalMargins.small)},
      }),
      wrapper: {width: Kb.Styles.globalStyles.mediumWidth},
    }) as const
)

export default UsernameOrEmailContainer
