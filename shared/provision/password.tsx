import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import UserCard from '../login/user-card'
import {SignupScreen, errorBanner} from '../signup/common'
import {startRecoverPassword} from '@/login/recover-password/flow'
import {submitProvisionPassphrase} from './flow'

type Props = {
  route: {
    params: {
      error?: string
      username: string
    }
  }
}

const Password = ({route}: Props) => {
  const {username} = route.params
  const error = route.params.error ?? ''
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyProvision)
  const [resetEmailSent, setResetEmailSent] = React.useState(false)
  const onForgotPassword = () => {
    startRecoverPassword({abortProvisioning: true, onResetEmailSent: () => setResetEmailSent(true), username})
  }
  const onBack = C.Router2.navigateUp
  const [password, setPassword] = React.useState('')
  const onSubmit = () => !waiting && submitProvisionPassphrase(password)

  return (
    <SignupScreen
      hideDesktopHeader={!isMobile}
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
          onClick: onSubmit,
          type: 'Default',
          waiting,
        },
      ]}
      onBack={onBack}
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
          username={username}
          avatarBackgroundStyle={styles.outerCardAvatar}
          outerStyle={styles.outerCard}
          avatarSize={96}
        >
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.wrapper} gap="xsmall">
            <Kb.Input3
              autoFocus={true}
              placeholder="Password"
              onEnterKeyDown={onSubmit}
              onChangeText={setPassword}
              value={password}
              textType="BodySemibold"
              secureTextEntry={true}
            />
            <Kb.Text style={styles.forgotPassword} type="BodySmallSecondaryLink" onClick={onForgotPassword}>
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
      ...Kb.Styles.paddingH(0),
    },
  }),
  contentContainer: Kb.Styles.platformStyles({isMobile: {...Kb.Styles.padding(0)}}),
  fill: Kb.Styles.platformStyles({
    isMobile: {...Kb.Styles.size('100%')},
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
