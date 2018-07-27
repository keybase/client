// @flow
import * as React from 'react'
import * as Types from '../../constants/types/devices'
import * as Common from '../../common-adapters'
import * as Styles from '../../styles'
import moment from 'moment'

type Props = {
  device: Types.Device,
  onBack: () => void,
  showRevokeDevicePage: () => void,
}

const TimelineMarker = ({first, last, closedCircle}) => (
  <Common.Box style={styles.marker}>
    <Common.Box style={Styles.collapseStyles([styles.timelineLineTop, first && styles.invisible])} />
    <Common.Box style={closedCircle ? styles.circleClosed : styles.circleOpen} />
    <Common.Box style={Styles.collapseStyles([styles.timelineLineBottom, last && styles.invisible])} />
  </Common.Box>
)

const TimelineLabel = ({desc, subDesc, subDescIsName, spacerOnBottom}) => (
  <Common.Box2 direction="vertical" style={styles.timelineLabel}>
    <Common.Text type="Body">{desc}</Common.Text>
    {!!subDesc &&
      subDescIsName && (
        <Common.Text type="BodySmall">
          by{' '}
          <Common.Text type="BodySmallItalic" style={styles.subDesc}>
            {subDesc}
          </Common.Text>
        </Common.Text>
      )}
    {!!subDesc && !subDescIsName && <Common.Text type="BodySmall">{subDesc}</Common.Text>}
    {spacerOnBottom && <Common.Box style={{height: 15}} />}
  </Common.Box2>
)

const formatTime = t => moment(t).format('MMM D, YYYY')
const Timeline = ({device}) => {
  const timeline = [
    ...(device.revokedAt
      ? [
          {
            desc: `Revoked ${formatTime(device.revokedAt)}`,
            subDesc: device.revokedByName || '',
            type: 'Revoked',
          },
        ]
      : []),
    ...(device.lastUsed
      ? [
          {
            desc: `Last used ${formatTime(device.lastUsed)}`,
            subDesc: moment(device.lastUsed).fromNow(),
            type: 'LastUsed',
          },
        ]
      : []),
    {
      desc: `Added ${formatTime(device.created)}`,
      subDesc: device.provisionerName || '',
      type: 'Added',
    },
  ]

  return (
    <Common.Box2 direction="vertical">
      {timeline.map(({type, desc, subDesc}, idx) => (
        <Common.Box2 direction="horizontal" key={desc} gap="small" fullWidth={true}>
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
        </Common.Box2>
      ))}
    </Common.Box2>
  )
}

const DevicePage = (props: Props) => {
  let metaOne
  if (props.device.currentDevice) {
    metaOne = 'Current device'
  } else if (props.device.revokedAt) {
    metaOne = <Common.Meta title="revoked" style={styles.meta} backgroundColor={Styles.globalColors.red} />
  }

  const icon: Common.IconType = {
    backup: 'icon-paper-key-64',
    desktop: 'icon-computer-64',
    mobile: 'icon-phone-64',
  }[props.device.type]

  const revokeName = {
    backup: 'paper key',
    desktop: 'device',
    mobile: 'device',
  }[props.device.type]

  return (
    <Common.Box2 direction="vertical" gap="medium" gapStart={true} gapEnd={true} fullWidth={true}>
      <Common.NameWithIcon icon={icon} title={props.device.name} metaOne={metaOne} />
      <Timeline device={props.device} />
      {!props.device.revokedAt && (
        <Common.Button
          type="Danger"
          label={`Revoke this ${revokeName}`}
          onClick={props.showRevokeDevicePage}
        />
      )}
    </Common.Box2>
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
    backgroundColor: Styles.globalColors.lightGrey2,
    borderColor: Styles.globalColors.white,
  },
  circleOpen: {
    ...circleCommon,
    borderColor: Styles.globalColors.lightGrey2,
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
  subDesc: {color: Styles.globalColors.black_75},
  timelineLabel: {alignItems: 'flex-start'},
  timelineLineBottom: {
    backgroundColor: Styles.globalColors.lightGrey2,
    flex: 1,
    width: 2,
  },
  timelineLineTop: {
    backgroundColor: Styles.globalColors.lightGrey2,
    height: 6,
    width: 2,
  },
})

export default Common.HeaderHoc(DevicePage)
