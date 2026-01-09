import * as C from '@/constants'
import {useProfileState} from '@/stores/profile'
import * as Kb from '@/common-adapters'
import {SiteIcon} from './shared'

const GenericResult = () => {
  const errorText = useProfileState(s =>
    s.errorCode !== undefined ? s.errorText || 'Failed to verify proof' : ''
  )
  const proofUsername = useProfileState(s => s.username + (s.platformGenericParams?.suffix ?? '@unknown'))
  const serviceIcon = useProfileState(s => s.platformGenericParams?.logoFull ?? [])
  const backToProfile = useProfileState(s => s.dispatch.backToProfile)
  const clearPlatformGeneric = useProfileState(s => s.dispatch.clearPlatformGeneric)
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const onClose = () => {
    clearModals()
    backToProfile()
    clearPlatformGeneric()
  }

  const success = !errorText
  const iconType = success ? 'icon-proof-success' : 'icon-proof-broken'
  let frag = (
    <>
      <Kb.Text type="Body">You are provably</Kb.Text>
      <Kb.Text type="BodySemibold">{proofUsername}</Kb.Text>
    </>
  )
  if (!success) {
    frag = (
      <>
        <Kb.Text type="Body">{errorText}</Kb.Text>
      </>
    )
  }
  return (
    <Kb.PopupWrapper>
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
        <Kb.Box2
          direction="vertical"
          centerChildren={true}
          alignItems="center"
          fullWidth={true}
          style={styles.topContainer}
        >
          <Kb.Box2 direction="vertical" style={styles.serviceIconContainer}>
            <SiteIcon set={serviceIcon} full={true} />
            <Kb.Box2 direction="vertical" style={styles.iconBadgeContainer}>
              <Kb.Icon type={iconType} color={Kb.Styles.globalColors.green} />
            </Kb.Box2>
          </Kb.Box2>
          {frag}
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" centerChildren={true} fullWidth={true} style={styles.bottomContainer}>
          <Kb.Button type="Dim" label="Close and reload Profile" onClick={onClose} />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.PopupWrapper>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      bottomContainer: {
        height: 80,
      },
      container: Kb.Styles.platformStyles({
        isElectron: {
          height: 485,
          width: 560,
        },
      }),
      iconBadgeContainer: {
        bottom: -5,
        position: 'absolute',
        right: -5,
      },
      serviceIcon: {
        height: 64,
        width: 64,
      },
      serviceIconContainer: Kb.Styles.platformStyles({
        common: {
          marginBottom: Kb.Styles.globalMargins.tiny,
          position: 'relative',
        },
      }),
      topContainer: Kb.Styles.platformStyles({
        common: {
          flex: 1,
        },
      }),
    }) as const
)

export default GenericResult
