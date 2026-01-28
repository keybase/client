import * as C from '@/constants'
import * as AutoReset from '@/stores/autoreset'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {SignupScreen} from '@/signup/common'
import {useSafeNavigation} from '@/util/safe-navigation'

const KnowPassword = () => {
  const error = AutoReset.useAutoResetState(s => s.error)
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyAutoresetEnterPipeline)
  const nav = useSafeNavigation()
  const onCancel = React.useCallback(() => nav.safeNavigateUp(), [nav])
  const onYes = React.useCallback(() => nav.safeNavigateAppend('resetEnterPassword'), [nav])
  const resetAccount = AutoReset.useAutoResetState(s => s.dispatch.resetAccount)
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
        <Kb.Icon type="iconfont-password" color={Kb.Styles.globalColors.black} fontSize={24} />
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

const styles = Kb.Styles.styleSheetCreate(() => ({
  input: Kb.Styles.platformStyles({
    isElectron: {
      width: 368,
    },
  }),
  topGap: Kb.Styles.platformStyles({
    isMobile: {
      justifyContent: 'flex-start',
      marginTop: '20%',
    },
  }),
}))

export default KnowPassword
