import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Container from '../../../util/container'
import * as AutoresetGen from '../../../actions/autoreset-gen'
import * as AutoresetConstants from '../../../constants/autoreset'
import * as RecoverPasswordGen from '../../../actions/recover-password-gen'
import * as RPCTypes from '../../../constants/types/rpc-gen'
import {SignupScreen, InfoIcon} from '../../../signup/common'
import type {ButtonType} from '../../../common-adapters/button'

export type Props = {
  resetPassword?: boolean
}

const PromptReset = (props: Props) => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const skipPassword = Container.useSelector(state => state.autoreset.skipPassword)
  const error = Container.useSelector(state => state.autoreset.error)
  const {resetPassword} = props
  const onContinue = React.useCallback(
    () =>
      dispatch(
        resetPassword
          ? RecoverPasswordGen.createSubmitResetPassword({
              action: RPCTypes.ResetPromptResponse.confirmReset,
            })
          : skipPassword
          ? AutoresetGen.createResetAccount({})
          : nav.safeNavigateAppendPayload({path: ['resetKnowPassword'], replace: true})
      ),
    [dispatch, skipPassword, resetPassword, nav]
  )
  const onBack = React.useCallback(
    () => dispatch(skipPassword ? RecoverPasswordGen.createRestartRecovery() : nav.safeNavigateUpPayload()),
    [dispatch, skipPassword, nav]
  )
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

const navigationOptions = {
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
  headerRightActions: () => (
    <Kb.Box2 direction="horizontal" style={styles.questionBox}>
      <InfoIcon />
    </Kb.Box2>
  ),
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

const PromptResetAccount = () => <PromptReset />
PromptResetAccount.navigationOptions = navigationOptions
const PromptResetPassword = () => <PromptReset resetPassword={true} />
PromptResetPassword.navigationOptions = navigationOptions

export {PromptResetAccount, PromptResetPassword}
