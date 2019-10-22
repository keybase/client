import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Container from '../../../util/container'
import * as RecoverPasswordGen from '../../../actions/recover-password-gen'
import * as RPCTypes from '../../../constants/types/rpc-gen'
import * as AutoresetConstants from '../../../constants/autoreset'
import {SignupScreen, InfoIcon} from '../../../signup/common'
import {ButtonType} from '../../../common-adapters/button'

export type Props = {}

const PromptResetPassword = (_: Props) => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const error = Container.useSelector(state => state.autoreset.error)
  const onContinue = React.useCallback(
    () =>
      dispatch(
        RecoverPasswordGen.createSubmitResetPassword({
          action: RPCTypes.ResetPromptResponse.confirmReset,
        })
      ),
    [dispatch]
  )
  const onBack = React.useCallback(() => dispatch(nav.safeNavigateUpPayload()), [dispatch, nav])

  return (
    <SignupScreen
      buttons={[
        {
          label: 'Send a link',
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
      title="Reset password"
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
        <Kb.Text type="Body" center={true} style={styles.main}>
          If you have forgotten your password you can reset it here. You will keep your username, but{' '}
          <Kb.Text type="BodyBold">
            lose all your encrypted data, including all of your uploaded private PGP keys
          </Kb.Text>
          .
        </Kb.Text>
      </Kb.Box2>
    </SignupScreen>
  )
}

PromptResetPassword.navigationOptions = {
  header: null,
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
      marginTop: 120,
    },
  }),
}))

export default PromptResetPassword
