import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import {formatTimeForDeviceTimeline, formatTimeRelativeToNow} from '@/util/timestamp'
import {getDeviceIconType} from './device-icon'

type DevicePageProps = {canRevoke: boolean; device: T.Devices.Device}

type TimelineEventType = 'Revoked' | 'LastUsed' | 'Added'

const TimelineMarker = (p: {first: boolean; last: boolean; closedCircle: boolean}) => {
  const {first, last, closedCircle} = p
  return (
    <Kb.Box2 direction="vertical" alignItems="center" alignSelf="stretch">
      <Kb.Box2 direction="vertical" style={Kb.Styles.collapseStyles([styles.timelineLineTop, first && styles.invisible])} />
      <Kb.Box2 direction="vertical" style={closedCircle ? styles.circleClosed : styles.circleOpen} />
      <Kb.Box2 direction="vertical" style={Kb.Styles.collapseStyles([styles.timelineLineBottom, last && styles.invisible])} />
    </Kb.Box2>
  )
}

const TimelineLabel = (p: {
  desc: string
  subDesc: string
  subDescIsName: boolean
  spacerOnBottom: boolean
}) => {
  const {desc, subDesc, subDescIsName, spacerOnBottom} = p
  return (
    <Kb.Box2 direction="vertical" alignItems="flex-start">
      <Kb.Text type="Body">{desc}</Kb.Text>
      {!!subDesc && subDescIsName && (
        <Kb.Text type="BodySmall">
          by{' '}
          <Kb.Text type="BodySmallItalic" style={styles.subDesc}>
            {subDesc}
          </Kb.Text>
        </Kb.Text>
      )}
      {!!subDesc && !subDescIsName && <Kb.Text type="BodySmall">{subDesc}</Kb.Text>}
      {spacerOnBottom && <Kb.Box2 direction="vertical" style={styles.timelineSpacer} />}
    </Kb.Box2>
  )
}

const Timeline = (p: {device: T.Devices.Device}) => {
  const {device} = p
  const timeline: Array<{desc: string; subDesc: string; type: TimelineEventType}> = [
    ...(device.revokedAt
      ? [
          {
            desc: `Revoked ${formatTimeForDeviceTimeline(device.revokedAt)}`,
            subDesc: device.revokedByName || '',
            type: 'Revoked' as const,
          },
        ]
      : []),
    ...(device.lastUsed
      ? [
          {
            desc: `Last used ${formatTimeForDeviceTimeline(device.lastUsed)}`,
            subDesc: formatTimeRelativeToNow(device.lastUsed),
            type: 'LastUsed' as const,
          },
        ]
      : []),
    {
      desc: `Added ${formatTimeForDeviceTimeline(device.created)}`,
      subDesc: device.provisionerName || '',
      type: 'Added' as const,
    },
  ]

  return (
    <Kb.Box2 direction="vertical">
      {timeline.map(({type, desc, subDesc}, idx) => (
        <Kb.Box2 direction="horizontal" key={desc} gap="small" fullWidth={true}>
          <TimelineMarker
            first={idx === 0}
            last={idx === timeline.length - 1}
            closedCircle={type === 'Revoked'}
          />
          <TimelineLabel
            spacerOnBottom={idx < timeline.length - 1}
            desc={desc}
            subDesc={subDesc}
            subDescIsName={['Added', 'Revoked'].includes(type)}
          />
        </Kb.Box2>
      ))}
    </Kb.Box2>
  )
}

const DevicePage = (ownProps: DevicePageProps) => {
  const {canRevoke, device} = ownProps
  const navigateAppend = C.Router2.navigateAppend
  const showRevokeDevicePage = () => {
    navigateAppend({name: 'deviceRevoke', params: {device}})
  }

  const metaOne = device.currentDevice ? (
    'Current device'
  ) : device.revokedAt ? (
    <Kb.Meta title="revoked" style={styles.meta} backgroundColor={Kb.Styles.globalColors.red} />
  ) : null

  const deviceType = device.type

  const revokeName = {
    backup: 'paper key',
    desktop: 'computer',
    mobile: 'device',
  }[deviceType]

  const metaTwo = {
    backup: 'Paper key',
    desktop: 'Computer',
    mobile: 'Device',
  }[deviceType]

  return (
    <Kb.Box2
      alignItems="center"
      direction="vertical"
      gap="medium"
      gapStart={true}
      gapEnd={true}
      fullWidth={true}
      fullHeight={true}
      testID={TestIDs.DEVICE_PAGE}
    >
      <Kb.NameWithIcon icon={getDeviceIconType(device.type, T.Devices.deviceNumberToIconNumber(device.deviceNumberOfType), 96)} title={device.name} metaOne={metaOne} metaTwo={metaTwo} size="big" />
      <Timeline device={device} />
      {device.revokedAt ? null : (
        <Kb.Button
          disabled={!canRevoke}
          type="Danger"
          label={`Revoke this ${revokeName}`}
          onClick={showRevokeDevicePage}
        />
      )}
      {canRevoke ? null : <Kb.Text type="BodySmall">{"You can't revoke your last device."}</Kb.Text>}
    </Kb.Box2>
  )
}
const circleSize = 8

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      circleClosed: {
        backgroundColor: Kb.Styles.globalColors.grey,
        borderColor: Kb.Styles.globalColors.white,
        borderRadius: circleSize / 2,
        borderStyle: 'solid',
        borderWidth: 2,
        ...Kb.Styles.size(circleSize),
      },
      circleOpen: {
        borderColor: Kb.Styles.globalColors.grey,
        borderRadius: circleSize / 2,
        borderStyle: 'solid',
        borderWidth: 2,
        ...Kb.Styles.size(circleSize),
      },
      invisible: {opacity: 0},
      meta: {
        alignSelf: 'center',
        marginTop: 4,
      },
      subDesc: {color: Kb.Styles.globalColors.black},
      timelineLineBottom: {
        backgroundColor: Kb.Styles.globalColors.grey,
        flex: 1,
        width: 2,
      },
      timelineLineTop: {
        backgroundColor: Kb.Styles.globalColors.grey,
        height: 6,
        width: 2,
      },
      timelineSpacer: {height: 15},
    }) as const
)

export default DevicePage
