import * as C from '@/constants'
import * as AutoReset from '@/stores/autoreset'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {useSafeNavigation} from '@/util/safe-navigation'
import * as T from '@/constants/types'
import {SignupScreen} from '@/signup/common'
import type {ButtonType} from '@/common-adapters/button'
import {useState as useRecoverState} from '@/stores/recover-password'

export type Props = {
  resetPassword?: boolean
}

const PromptReset = (props: Props) => {
  const nav = useSafeNavigation()
  const skipPassword = AutoReset.useAutoResetState(s => s.skipPassword)
  const error = AutoReset.useAutoResetState(s => s.error)
  const resetAccount = AutoReset.useAutoResetState(s => s.dispatch.resetAccount)
  const {resetPassword} = props

  const submitResetPassword = useRecoverState(s => s.dispatch.dynamic.submitResetPassword)
  const startRecoverPassword = useRecoverState(s => s.dispatch.startRecoverPassword)
  const username = useRecoverState(s => s.username)

  const onContinue = React.useCallback(() => {
    // dont do this in preflight
    if (C.androidIsTestDevice) {
      nav.safeNavigateUp()
      return
    }
    if (resetPassword) {
      submitResetPassword?.(T.RPCGen.ResetPromptResponse.confirmReset)
    }
    if (skipPassword) {
      resetAccount()
    } else {
      nav.safeNavigateAppend('resetKnowPassword', true)
    }
  }, [submitResetPassword, resetAccount, skipPassword, resetPassword, nav])
  const onBack = React.useCallback(() => {
    if (skipPassword) {
      startRecoverPassword({replaceRoute: true, username})
    } else {
      nav.safeNavigateUp()
    }
  }, [startRecoverPassword, skipPassword, nav, username])
  const title = props.resetPassword ? 'Reset password' : skipPassword ? 'Recover password' : 'Account reset'

  return (
    <SignupScreen
      buttons={[
        {
          label: props.resetPassword ? 'Send a link' : 'Start account reset',
          onClick: onContinue,
          type: 'Default' as ButtonType,
          waitingKey: C.waitingKeyAutoresetEnterPipeline,
        },
      ]}
      banners={
        error ? (
          <Kb.Banner color="red">
            <Kb.BannerParagraph bannerColor="red" content={error} />
          </Kb.Banner>
        ) : null
      }
      onBack={onBack}
      noBackground={true}
      title={title}
      leftActionText="Cancel"
    >
      <Kb.Box2
        alignItems="center"
        direction="vertical"
        fullHeight={true}
        fullWidth={true}
        gap="medium"
        style={styles.topGap}
      >
        <Kb.Icon type="iconfont-skull" sizeType="Big" color={Kb.Styles.globalColors.black} />
        {props.resetPassword ? (
          <Kb.Text type="Body" center={true} style={styles.main}>
            If you have forgotten your password you can reset it here. You will keep your username, but{' '}
            <Kb.Text type="BodyBold">
              lose all your encrypted data, including all of your uploaded private PGP keys
            </Kb.Text>
            .
          </Kb.Text>
        ) : (
          <>
            <Kb.Text type="Body" center={true} style={styles.main}>
              If you have lost all of your devices, or if you logged out or uninstalled Keybase from all of
              them and forgot your password, you can reset your account.
            </Kb.Text>
            <Kb.Text type="Body" center={true} style={styles.main}>
              You will keep your username but{' '}
              <Kb.Text type="BodyBold">
                lose all your data (chat, files, git repos) and be removed from teams.
              </Kb.Text>{' '}
              Teams for which you were the last admin or owner will be lost forever.
            </Kb.Text>
          </>
        )}
      </Kb.Box2>
    </SignupScreen>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  main: {
    ...Kb.Styles.padding(0, Kb.Styles.globalMargins.medium, Kb.Styles.globalMargins.small),
    maxWidth: 500,
  },
  questionBox: Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.tiny, 0),
  topGap: Kb.Styles.platformStyles({
    isMobile: {
      justifyContent: 'flex-start',
      marginTop: '20%',
    },
  }),
}))

export default PromptReset
