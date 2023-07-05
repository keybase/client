import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as AutoresetConstants from '../../constants/autoreset'
import * as Constants from '../../constants/recover-password'
import * as RPCTypes from '../../constants/types/rpc-gen'
import {SignupScreen} from '../../signup/common'
import type {ButtonType} from '../../common-adapters/button'

export type Props = {
  resetPassword?: boolean
}

const PromptReset = (props: Props) => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const skipPassword = AutoresetConstants.useState(s => s.skipPassword)
  const error = AutoresetConstants.useState(s => s.error)
  const resetAccount = AutoresetConstants.useState(s => s.dispatch.resetAccount)
  const {resetPassword} = props

  const submitResetPassword = Constants.useState(s => s.dispatch.submitResetPassword)
  const startRecoverPassword = Constants.useState(s => s.dispatch.startRecoverPassword)
  const username = Constants.useState(s => s.username)

  const onContinue = React.useCallback(() => {
    if (resetPassword) {
      submitResetPassword(RPCTypes.ResetPromptResponse.confirmReset)
    }
    if (skipPassword) {
      resetAccount()
    } else {
      dispatch(nav.safeNavigateAppendPayload({path: ['resetKnowPassword'], replace: true}))
    }
  }, [submitResetPassword, resetAccount, dispatch, skipPassword, resetPassword, nav])
  const onBack = React.useCallback(() => {
    if (skipPassword) {
      startRecoverPassword({replaceRoute: true, username})
    } else {
      dispatch(nav.safeNavigateUpPayload())
    }
  }, [startRecoverPassword, dispatch, skipPassword, nav, username])
  const title = props.resetPassword ? 'Reset password' : skipPassword ? 'Recover password' : 'Account reset'

  return (
    <SignupScreen
      buttons={[
        {
          label: props.resetPassword ? 'Send a link' : 'Start account reset',
          onClick: onContinue,
          type: 'Default' as ButtonType,
          waitingKey: AutoresetConstants.enterPipelineWaitingKey,
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
        <Kb.Icon type="iconfont-skull" sizeType="Big" color={Styles.globalColors.black} />
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

const styles = Styles.styleSheetCreate(() => ({
  main: {
    ...Styles.padding(0, Styles.globalMargins.medium, Styles.globalMargins.small),
    maxWidth: 500,
  },
  questionBox: Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.tiny, 0),
  topGap: Styles.platformStyles({
    isMobile: {
      justifyContent: 'flex-start',
      marginTop: '20%',
    },
  }),
}))

export default PromptReset
