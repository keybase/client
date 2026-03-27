import * as C from '@/constants'
import {useProfileState} from '@/stores/profile'
import * as Kb from '@/common-adapters'
import {SiteIcon} from './shared'
import {useCurrentUserState} from '@/stores/current-user'
import type {ProveGenericParams} from '@/stores/profile'

type Props = {
  error?: string
  genericParams: ProveGenericParams
  username: string
}

const GenericResult = ({error = '', genericParams, username}: Props) => {
  const proofUsername = username + genericParams.suffix
  const serviceIcon = genericParams.logoFull
  const showUserProfile = useProfileState(s => s.dispatch.showUserProfile)
  const currentUsername = useCurrentUserState(s => s.username)
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const onClose = () => {
    clearModals()
    showUserProfile(currentUsername)
  }

  const success = !error
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
        <Kb.Text type="Body">{error}</Kb.Text>
      </>
    )
  }
  return (
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
            <Kb.ImageIcon type={iconType} />
          </Kb.Box2>
        </Kb.Box2>
        {frag}
      </Kb.Box2>
      <Kb.Box2 direction="horizontal" centerChildren={true} fullWidth={true} style={styles.bottomContainer}>
        <Kb.Button type="Dim" label="Close and reload Profile" onClick={onClose} />
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      bottomContainer: {
        height: 80,
      },
      container: {},
      iconBadgeContainer: {
        bottom: -5,
        position: 'absolute',
        right: -5,
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
