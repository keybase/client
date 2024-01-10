import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import UserCard from '@/login/user-card'
import {SignupScreen, errorBanner} from '@/signup/common'

type Props = {
  error: string
  initialUsername: string
  inlineError: string
  inlineSignUpLink: boolean
  onBack: () => void
  onForgotUsername: () => void
  onGoToSignup: (username: string) => void
  onSubmit: (username: string) => void
  resetBannerUser?: string
  waiting: boolean
}

const Username = (props: Props) => {
  const {initialUsername, onSubmit: _onSubmit, onGoToSignup: _onGoToSignup, waiting} = props
  const {resetBannerUser, inlineSignUpLink, error, onBack, onForgotUsername} = props
  const [username, setUsername] = React.useState(initialUsername)
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
              maxLength={C.Signup.maxUsernameLength}
              onEnterKeyDown={onSubmit}
              onChangeText={setUsername}
              value={username}
              textType="BodySemibold"
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
        isTablet: {
          alignItems: 'center',
        },
      }),
      contentContainer: Kb.Styles.platformStyles({isMobile: {...Kb.Styles.padding(0)}}),
      fill: Kb.Styles.platformStyles({
        isMobile: {height: '100%', width: '100%'},
        isTablet: {width: 410},
      }),
      forgotUsername: {
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
      wrapper: {
        width: Kb.Styles.globalStyles.mediumWidth,
      },
    }) as const
)

export default Username
