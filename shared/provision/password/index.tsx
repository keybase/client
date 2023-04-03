import * as React from 'react'
import * as Container from '../../util/container'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as RecoverPasswordGen from '../../actions/recover-password-gen'
import {SignupScreen, errorBanner} from '../../signup/common'
import {isMobile} from '../../constants/platform'
import UserCard from '../../login/user-card'

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
  const dispatch = Container.useDispatch()
  const {onSubmit} = props
  const _onSubmit = React.useCallback(() => onSubmit(password), [password, onSubmit])

  React.useEffect(
    () => () => {
      dispatch(RecoverPasswordGen.createResetResetPasswordState())
    },
    [dispatch]
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

Password.navigationOptions = {
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
}

const styles = Styles.styleSheetCreate(() => ({
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
  fill: Styles.platformStyles({
    isMobile: {height: '100%', width: '100%'},
    isTablet: {width: 410},
  }),
  forgotPassword: {
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
}))

export default Password
