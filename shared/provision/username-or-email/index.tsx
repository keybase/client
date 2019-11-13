import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {maxUsernameLength} from '../../constants/signup'
import {SignupScreen, errorBanner} from '../../signup/common'

type Props = {
  error: string
  initialUsername: string
  inlineError: string
  inlineSignUpLink: boolean
  onBack: () => void
  onForgotUsername: () => void
  onGoToSignup: () => void
  onSubmit: (username: string) => void
  resetBannerUser: string | null
  submittedUsername: string
  waiting: boolean
}

const Username = (props: Props) => {
  const [username, setUsername] = React.useState(props.initialUsername)
  const _onSubmit = props.onSubmit
  const onSubmit = React.useCallback(() => {
    _onSubmit(username)
  }, [_onSubmit, username])

  return (
    <SignupScreen
      banners={[
        ...(props.resetBannerUser
          ? [
              <Kb.Banner color="green" key="resetBanner">
                <Kb.BannerParagraph
                  bannerColor="green"
                  content={`You have successfully reset your account, ${props.resetBannerUser}. You can now log in as usual.`}
                />
              </Kb.Banner>,
            ]
          : []),
        ...errorBanner(props.error),
        ...(props.inlineSignUpLink
          ? [
              <Kb.Banner key="usernameTaken" color="blue">
                <Kb.BannerParagraph
                  bannerColor="blue"
                  content={[
                    "This username doesn't exist. Did you mean to ",
                    {
                      onClick: () => props.inlineSignUpLink && props.onGoToSignup(),
                      text: 'create a new account',
                    },
                    '?',
                  ]}
                />
              </Kb.Banner>,
            ]
          : []),
      ]}
      buttons={[
        {
          disabled: !username,
          label: 'Log in',
          onClick: onSubmit,
          type: 'Default',
          waiting: props.waiting,
        },
      ]}
      onBack={props.onBack}
      title="Log in"
      contentContainerStyle={styles.contentContainer}
    >
      <Kb.ScrollView
        alwaysBounceVertical={false}
        style={styles.fill}
        contentContainerStyle={styles.scrollContentContainer}
      >
        <Kb.UserCard
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
              maxLength={maxUsernameLength}
              onEnterKeyDown={onSubmit}
              onChangeText={setUsername}
              value={username}
              textType="BodySemibold"
            />
            <Kb.Text
              style={styles.forgotUsername}
              type="BodySmallSecondaryLink"
              onClick={props.onForgotUsername}
            >
              Forgot username?
            </Kb.Text>
          </Kb.Box2>
        </Kb.UserCard>
      </Kb.ScrollView>
    </SignupScreen>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      card: Styles.platformStyles({
        common: {
          alignItems: 'stretch',
          backgroundColor: Styles.globalColors.transparent,
        },
        isMobile: {
          paddingLeft: 0,
          paddingRight: 0,
        },
      }),
      contentContainer: Styles.platformStyles({isMobile: {...Styles.padding(0)}}),
      fill: Styles.platformStyles({isMobile: {height: '100%', width: '100%'}}),
      forgotUsername: {
        alignSelf: 'flex-end',
      },
      outerCard: {
        flex: 1,
        height: Styles.isMobile ? undefined : 'unset',
      },
      outerCardAvatar: {
        backgroundColor: Styles.globalColors.transparent,
      },
      scrollContentContainer: Styles.platformStyles({
        isElectron: {
          margin: 'auto',
        },
        isMobile: {...Styles.padding(Styles.globalMargins.small)},
      }),
      wrapper: Styles.platformStyles({
        isElectron: {
          width: 400,
        },
        isMobile: {
          width: '100%',
        },
      }),
    } as const)
)

Username.navigationOptions = {
  header: null,
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
}

export default Username
