import * as C from '@/constants'
import * as AutoReset from '@/stores/autoreset'
import * as Kb from '@/common-adapters'
import {SignupScreen} from '@/signup/common'
import {useSafeNavigation} from '@/util/safe-navigation'

type Props = {route: {params: {username: string}}}

const KnowPassword = ({route}: Props) => {
  const {username} = route.params
  const error = AutoReset.useAutoResetState(s => s.error)
  const waiting = C.Waiting.useAnyWaiting(C.waitingKeyAutoresetEnterPipeline)
  const nav = useSafeNavigation()
  const onCancel = () => nav.safeNavigateUp()
  const onYes = () => nav.safeNavigateAppend({name: 'resetEnterPassword', params: {username}})
  const resetAccount = AutoReset.useAutoResetState(s => s.dispatch.resetAccount)
  const onNo = () => resetAccount(username)
  return (
    <SignupScreen
      title="Account reset"
      noBackground={true}
      onBack={onCancel}
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
  topGap: Kb.Styles.platformStyles({
    isMobile: {
      justifyContent: 'flex-start',
      marginTop: '20%',
    },
  }),
}))

export default KnowPassword
