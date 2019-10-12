import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Container from '../../../util/container'
import * as AutoresetGen from '../../../actions/autoreset-gen'
import {SignupScreen, InfoIcon} from '../../../signup/common'
import {ButtonType} from '../../../common-adapters/button'

export type Props = {}

const PromptReset = (_: Props) => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const skipPassword = Container.useSelector(state => state.autoreset.skipPassword)
  const error = Container.useSelector(state => state.autoreset.error)
  const onContinue = React.useCallback(
    () =>
      dispatch(
        skipPassword
          ? AutoresetGen.createResetAccount({})
          : nav.safeNavigateAppendPayload({path: ['resetKnowPassword']})
      ),
    [dispatch, skipPassword, nav]
  )
  const onBack = React.useCallback(() => dispatch(nav.safeNavigateUpPayload()), [dispatch, nav])
  return (
    <SignupScreen
      buttons={[
        {
          label: 'Start account reset',
          onClick: onContinue,
          type: 'Default' as ButtonType,
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
      title="Recover password"
    >
      <Kb.Box2 alignItems="center" direction="vertical" fullHeight={true} fullWidth={true} gap="medium">
        <Kb.Icon type="iconfont-skull" sizeType="Big" color={Styles.globalColors.black} />
        <Kb.Box2 alignItems="center" direction="vertical">
          <Kb.Text type="Body" center={true} style={styles.main}>
            If you have lost all of your devices, or if you logged out or uninstalled Keybase from all of them
            and forgot your password, you can reset your account.
          </Kb.Text>
          <Kb.Text type="Body" center={true} style={styles.main}>
            You will keep your username but{' '}
            <Kb.Text type="BodyBold">
              lose all your data (chat, files, git repos) and be removed from teams.
            </Kb.Text>{' '}
            Teams for which you were the last admin or owner will be lost forever.
          </Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    </SignupScreen>
  )
}

PromptReset.navigationOptions = {
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
}))

export default PromptReset
