import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {SignupScreen} from '../../signup/common'
import * as Container from '../../util/container'
import * as Constants from '../../constants/autoreset'

const KnowPassword = () => {
  const error = Constants.useState(s => s.error)
  const waiting = Container.useAnyWaiting(Constants.enterPipelineWaitingKey)

  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const onCancel = React.useCallback(() => nav.safeNavigateUp(), [nav])
  const onYes = React.useCallback(
    () => dispatch(nav.safeNavigateAppendPayload({path: ['resetEnterPassword']})),
    [dispatch, nav]
  )
  const resetAccount = Constants.useState(s => s.dispatch.resetAccount)
  const onNo = React.useCallback(() => resetAccount(), [resetAccount])
  return (
    <SignupScreen
      title="Account reset"
      noBackground={true}
      onBack={onCancel}
      leftActionText="Cancel"
      banners={
        error ? (
          <Kb.Banner color="red">
            <Kb.BannerParagraph bannerColor="red" content={error} />
          </Kb.Banner>
        ) : null
      }
      buttons={[
        {label: 'Yes', onClick: onYes, type: 'Success'},
        {label: 'No', onClick: onNo, type: 'Dim', waiting},
      ]}
    >
      <Kb.Box2
        direction="vertical"
        gap="medium"
        fullWidth={true}
        fullHeight={true}
        centerChildren={true}
        style={styles.topGap}
      >
        <Kb.Icon type="iconfont-password" color={Styles.globalColors.black} fontSize={24} />
        <Kb.Box2 direction="vertical" centerChildren={true}>
          <Kb.Text type="Header" center={true}>
            Do you know your
          </Kb.Text>
          <Kb.Text type="Header" center={true}>
            password?
          </Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    </SignupScreen>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  input: Styles.platformStyles({
    isElectron: {
      width: 368,
    },
  }),
  topGap: Styles.platformStyles({
    isMobile: {
      justifyContent: 'flex-start',
      marginTop: '20%',
    },
  }),
}))

export default KnowPassword
