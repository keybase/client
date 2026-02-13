import * as C from '@/constants'
import * as Devices from '@/stores/devices'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import type * as T from '@/constants/types'
import {formatTimeForDeviceTimeline, formatTimeRelativeToNow} from '@/util/timestamp'

type OwnProps = {deviceID: string}

const TimelineMarker = (p: {first: boolean; last: boolean; closedCircle: boolean}) => {
  const {first, last, closedCircle} = p
  return (
    <Kb.Box style={styles.marker}>
      <Kb.Box style={Kb.Styles.collapseStyles([styles.timelineLineTop, first && styles.invisible])} />
      <Kb.Box style={closedCircle ? styles.circleClosed : styles.circleOpen} />
      <Kb.Box style={Kb.Styles.collapseStyles([styles.timelineLineBottom, last && styles.invisible])} />
    </Kb.Box>
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
    <Kb.Box2 direction="vertical" style={styles.timelineLabel}>
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
      {spacerOnBottom && <Kb.Box style={{height: 15}} />}
    </Kb.Box2>
  )
}

const Timeline = (p: {device: T.Devices.Device}) => {
  const {device} = p
  const timeline = [
    ...(device.revokedAt
      ? [
          {
            desc: `Revoked ${formatTimeForDeviceTimeline(device.revokedAt)}`,
            subDesc: device.revokedByName || '',
            type: 'Revoked',
          },
        ]
      : []),
    ...(device.lastUsed
      ? [
          {
            desc: `Last used ${formatTimeForDeviceTimeline(device.lastUsed)}`,
            subDesc: formatTimeRelativeToNow(device.lastUsed),
            type: 'LastUsed',
          },
        ]
      : []),
    {
      desc: `Added ${formatTimeForDeviceTimeline(device.created)}`,
      subDesc: device.provisionerName || '',
      type: 'Added',
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

const DevicePage = (ownProps: OwnProps) => {
  const id = ownProps.deviceID
  const iconNumber = Devices.useDeviceIconNumber(id)
  const device = Devices.useDevicesState(s => s.deviceMap.get(id))
  const canRevoke = Devices.useActiveDeviceCounts() > 1
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const showRevokeDevicePage = React.useCallback(() => {
    navigateAppend({props: {deviceID: id}, selected: 'deviceRevoke'})
  }, [navigateAppend, id])

  const metaOne = device?.currentDevice ? (
    'Current device'
  ) : device?.revokedAt ? (
    <Kb.Meta title="revoked" style={styles.meta} backgroundColor={Kb.Styles.globalColors.red} />
  ) : null

  const deviceType = device?.type ?? 'desktop'

  const maybeIcon = (
    {
      backup: 'icon-paper-key-96',
      desktop: `icon-computer-background-${iconNumber}-96`,
      mobile: `icon-phone-background-${iconNumber}-96`,
    } as const
  )[deviceType]
  const icon = Kb.isValidIconType(maybeIcon) ? maybeIcon : 'icon-computer-96'

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
    >
      <Kb.NameWithIcon icon={icon} title={device?.name} metaOne={metaOne} metaTwo={metaTwo} size="big" />
      {device ? <Timeline device={device} /> : null}
      {device?.revokedAt ? null : (
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
const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      circleClosed: {
        backgroundColor: Kb.Styles.globalColors.grey,
        borderColor: Kb.Styles.globalColors.white,
        borderRadius: 8 / 2,
        borderStyle: 'solid',
        borderWidth: 2,
        height: 8,
        width: 8,
      },
      circleOpen: {
        borderColor: Kb.Styles.globalColors.grey,
        borderRadius: 8 / 2,
        borderStyle: 'solid',
        borderWidth: 2,
        height: 8,
        width: 8,
      },
      invisible: {opacity: 0},
      marker: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
      },
      meta: {
        alignSelf: 'center',
        marginTop: 4,
      },
      subDesc: {color: Kb.Styles.globalColors.black},
      timelineLabel: {alignItems: 'flex-start'},
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
    }) as const
)

export default DevicePage
