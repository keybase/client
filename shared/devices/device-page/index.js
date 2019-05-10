// @flow
import * as React from 'react'
import * as Types from '../../constants/types/devices'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {formatTimeForDeviceTimeline, formatTimeRelativeToNow} from '../../util/timestamp'

type Props = {
  device: Types.Device,
  onBack: () => void,
  showRevokeDevicePage: () => void,
}

const TimelineMarker = ({first, last, closedCircle}) => (
  <Kb.Box style={styles.marker}>
    <Kb.Box style={Styles.collapseStyles([styles.timelineLineTop, first && styles.invisible])} />
    <Kb.Box style={closedCircle ? styles.circleClosed : styles.circleOpen} />
    <Kb.Box style={Styles.collapseStyles([styles.timelineLineBottom, last && styles.invisible])} />
  </Kb.Box>
)

const TimelineLabel = ({desc, subDesc, subDescIsName, spacerOnBottom}) => (
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

const Timeline = ({device}) => {
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

const DevicePage = (props: Props) => {
  let metaOne
  if (props.device.currentDevice) {
    metaOne = 'Current device'
  } else if (props.device.revokedAt) {
    metaOne = <Kb.Meta title="revoked" style={styles.meta} backgroundColor={Styles.globalColors.red} />
  }

  const icon: Kb.IconType = {
    backup: 'icon-paper-key-96',
    desktop: 'icon-computer-96',
    mobile: 'icon-phone-96',
  }[props.device.type]

  const revokeName = {
    backup: 'paper key',
    desktop: 'computer',
    mobile: 'phone',
  }[props.device.type]

  const metaTwo = {
    backup: 'Paper key',
    desktop: 'Computer',
    mobile: 'Phone',
  }[props.device.type]

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
      <Kb.NameWithIcon icon={icon} title={props.device.name} metaOne={metaOne} metaTwo={metaTwo} size="big" />
      <Timeline device={props.device} />
      {!props.device.revokedAt && (
        <Kb.Button type="Danger" label={`Revoke this ${revokeName}`} onClick={props.showRevokeDevicePage} />
      )}
    </Kb.Box2>
  )
}

const circleCommon = {
  borderRadius: 8 / 2,
  borderStyle: 'solid',
  borderWidth: 2,
  height: 8,
  width: 8,
}

const styles = Styles.styleSheetCreate({
  circleClosed: {
    ...circleCommon,
    backgroundColor: Styles.globalColors.grey,
    borderColor: Styles.globalColors.white,
  },
  circleOpen: {
    ...circleCommon,
    borderColor: Styles.globalColors.grey,
  },
  invisible: {opacity: 0},
  marker: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
  },
  meta: {
    alignSelf: 'center',
    marginTop: 4,
  },
  subDesc: {color: Styles.globalColors.black},
  timelineLabel: {alignItems: 'flex-start'},
  timelineLineBottom: {
    backgroundColor: Styles.globalColors.grey,
    flex: 1,
    width: 2,
  },
  timelineLineTop: {
    backgroundColor: Styles.globalColors.grey,
    height: 6,
    width: 2,
  },
})

export default Kb.HeaderHoc(DevicePage)
