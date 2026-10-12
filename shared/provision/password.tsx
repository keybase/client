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
  const styles = useStyles()
  const {username} = route.params
  const error = route.params.error ?? ''
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyProvision)
  const [resetEmailSent, setResetEmailSent] = React.useState(false)
  const onForgotPassword = () => {
    startRecoverPassword({abortProvisioning: true, onResetEmailSent: () => setResetEmailSent(true), username})
  }
  const [password, setPassword] = React.useState('')
  const onSubmit = () => !waiting && submitProvisionPassphrase(password)
  // in a modal the box already scrolls
  const inModal = !!Kb.useModalBox()

  const card = (
    <UserCard
      style={styles.card}
      username={username}
      avatarBackgroundStyle={styles.outerCardAvatar}
      outerStyle={Kb.Styles.collapseStyles([styles.outerCard, inModal && styles.outerCardModal])}
      avatarSize={96}
    >
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        style={Kb.Styles.collapseStyles([styles.wrapper, inModal && styles.wrapperModal])}
        gap="xsmall"
      >
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
  )

  return (
    <SignupScreen
      waitingOverlay={true}
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
      contentContainerStyle={styles.contentContainer}
    >
      {inModal ? (
        card
      ) : (
        <Kb.ScrollView
          alwaysBounceVertical={false}
          style={styles.fill}
          contentContainerStyle={styles.scrollContentContainer}
        >
          {card}
        </Kb.ScrollView>
      )}
    </SignupScreen>
  )
}

const useStyles = Kb.Styles.createStyleHook(theme => ({
  card: Kb.Styles.platformStyles({
    common: {
      alignItems: 'stretch',
      backgroundColor: theme.transparent,
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
    backgroundColor: theme.transparent,
  },
  // UserCard is a fixed 410 wide on desktop, wider than a small modal box
  outerCardModal: Kb.Styles.platformStyles({isElectron: {maxWidth: 410, width: '100%'}}),
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
  wrapperModal: Kb.Styles.platformStyles({isElectron: {width: '100%'}}),
}))

export default Password
