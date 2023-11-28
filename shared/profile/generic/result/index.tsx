import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {SiteIcon} from '../shared'

type Props = {
  errorText: string
  onClose: () => void
  proofUsername: string
  serviceIcon: T.Tracker.SiteIconSet
}

const Result = (props: Props) => {
  const success = !props.errorText
  const iconType = success ? 'icon-proof-success' : 'icon-proof-broken'
  let frag = (
    <>
      <Kb.Text type="Body">You are provably</Kb.Text>
      <Kb.Text type="BodySemibold">{props.proofUsername}</Kb.Text>
    </>
  )
  if (!success) {
    frag = (
      <>
        <Kb.Text type="Body">{props.errorText}</Kb.Text>
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
            <SiteIcon set={props.serviceIcon} full={true} />
            <Kb.Box2 direction="vertical" style={styles.iconBadgeContainer}>
              <Kb.Icon type={iconType} color={Kb.Styles.globalColors.green} />
            </Kb.Box2>
          </Kb.Box2>
          {frag}
        </Kb.Box2>
        <Kb.Box2 direction="horizontal" centerChildren={true} fullWidth={true} style={styles.bottomContainer}>
          <Kb.Button type="Dim" label="Close and reload Profile" onClick={props.onClose} />
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

export default Result
