// @flow
import * as React from 'react'
import type {Time} from '../../constants/types/rpc-gen'
import {Meta, NameWithIcon, Box, Text, Button, Box2, HeaderHoc, type IconType} from '../../common-adapters'
import {globalStyles, globalColors, styleSheetCreate, collapseStyles} from '../../styles'

export type TimelineItem = {
  desc: string,
  subDesc?: string,
  type: 'LastUsed' | 'Added' | 'Revoked',
}

type Props = {
  currentDevice: boolean,
  deviceID: string,
  icon: IconType,
  name: string,
  onBack: () => void,
  revokeName: ?string,
  revokedAt?: ?Time,
  showRevokeDevicePage: () => void,
  timeline?: Array<TimelineItem>,
}

const TimelineMarker = ({first, last, closedCircle}) => (
  <Box style={collapseStyles([globalStyles.flexBoxColumn, {alignItems: 'center'}])}>
    <Box style={collapseStyles([styles.timelineLine, {height: 6, opacity: first ? 0 : 1}])} />
    <Box style={closedCircle ? styles.circleClosed : styles.circleOpen} />
    <Box style={collapseStyles([styles.timelineLine, {flex: 1, opacity: last ? 0 : 1}])} />
  </Box>
)

const TimelineLabel = ({desc, subDesc, subDescIsName, spacerOnBottom}) => (
  <Box2 direction="vertical" style={styles.timelineLabel}>
    <Text type="Body">{desc}</Text>
    {!!subDesc &&
      subDescIsName && (
        <Text type="BodySmall">
          by{' '}
          <Text type="BodySmall" style={styles.subDesc}>
            {subDesc}
          </Text>
        </Text>
      )}
    {!!subDesc && !subDescIsName && <Text type="BodySmall">{subDesc}</Text>}
    {spacerOnBottom && <Box style={{height: 15}} />}
  </Box2>
)

const Timeline = ({timeline}) =>
  timeline ? (
    <Box2 direction="vertical">
      {timeline.map(({type, desc, subDesc}, idx) => (
        <Box2 direction="horizontal" key={desc} gap="small" fullWidth={true}>
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
        </Box2>
      ))}
    </Box2>
  ) : null

const Render = (props: Props) => {
  let metaOne
  if (props.currentDevice) {
    metaOne = 'Current device'
  } else if (props.revokedAt) {
    metaOne = <Meta title="revoked" style={styles.meta} backgroundColor={globalColors.red} />
  }

  return (
    <Box2 direction="vertical" gap="medium" gapStart={true} gapEnd={true} fullWidth={true}>
      <NameWithIcon icon={props.icon} title={props.name} metaOne={metaOne} />
      <Timeline timeline={props.timeline} />
      {!props.revokedAt && (
        <Button
          type="Danger"
          label={`Revoke this ${props.revokeName || ''}`}
          onClick={props.showRevokeDevicePage}
        />
      )}
    </Box2>
  )
}

const circleCommon = {
  borderRadius: 8 / 2,
  borderStyle: 'solid',
  borderWidth: 2,
  height: 8,
  width: 8,
}

const titleCommon = {
  fontStyle: 'italic',
  textAlign: 'center',
}

const styles = styleSheetCreate({
  circleClosed: {
    ...circleCommon,
    backgroundColor: globalColors.lightGrey2,
    borderColor: globalColors.white,
  },
  circleOpen: {
    ...circleCommon,
    borderColor: globalColors.lightGrey2,
  },
  meta: {
    alignSelf: 'center',
    marginTop: 4,
  },
  subDesc: {
    color: globalColors.black_75,
    fontStyle: 'italic',
  },
  timelineLabel: {alignItems: 'flex-start'},
  timelineLine: {
    backgroundColor: globalColors.lightGrey2,
    width: 2,
  },
  title: titleCommon,
  titleRevoked: {
    ...titleCommon,
    color: globalColors.black_40,
    textDecorationLine: 'line-through',
  },
})

export default HeaderHoc(Render)
