import * as React from 'react'
import * as DevicesGen from '../../actions/devices-gen'
import * as Types from '../../constants/types/devices'
import * as Constants from '../../constants/devices'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import {formatTimeForDeviceTimeline, formatTimeRelativeToNow} from '../../util/timestamp'

type Props = {
  id: Types.DeviceID
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
  const device = Container.useSelector(state => Constants.getDevice(state, props.id))
  const canRevoke = Container.useSelector(state => {
    const {numActive} = Constants.getDeviceCounts(state)
    const hasRandomPW = state.settings.password.randomPW
    return numActive > 1 || !hasRandomPW
  })
  const dispatch = Container.useDispatch()
  const showRevokeDevicePage = React.useCallback(
    () => dispatch(DevicesGen.createShowRevokePage({deviceID: props.id})),
    [dispatch, props.id]
  )

  const metaOne = device.currentDevice ? (
    'Current device'
  ) : device.revokedAt ? (
    <Kb.Meta title="revoked" style={styles.meta} backgroundColor={Styles.globalColors.red} />
  ) : null

  const icon: Kb.IconType = ({
    backup: 'icon-paper-key-96',
    desktop: 'icon-computer-96',
    mobile: 'icon-phone-96',
  } as const)[device.type]

  const revokeName = {
    backup: 'paper key',
    desktop: 'computer',
    mobile: 'phone',
  }[device.type]

  const metaTwo = {
    backup: 'Paper key',
    desktop: 'Computer',
    mobile: 'Phone',
  }[device.type]

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
      <Kb.NameWithIcon icon={icon} title={device.name} metaOne={metaOne} metaTwo={metaTwo} size="big" />
      <Timeline device={device} />
      {!device.revokedAt && (
        <Kb.Button
          disabled={!canRevoke}
          type="Danger"
          label={`Revoke this ${revokeName}`}
          onClick={showRevokeDevicePage}
        />
      )}
      {!canRevoke && <Kb.Text type="BodySmall">You can't revoke your last device.</Kb.Text>}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  circleClosed: {
    backgroundColor: Styles.globalColors.grey,
    borderColor: Styles.globalColors.white,
    borderRadius: 8 / 2,
    borderStyle: 'solid',
    borderWidth: 2,
    height: 8,
    width: 8,
  },
  circleOpen: {
    borderColor: Styles.globalColors.grey,
    borderRadius: 8 / 2,
    borderStyle: 'solid',
    borderWidth: 2,
    height: 8,
    width: 8,
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
