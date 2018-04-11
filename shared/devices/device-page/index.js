// @flow
import * as React from 'react'
import {Meta, NameWithIcon, StandardScreen, Box, Text, Button, VBox, HBox} from '../../common-adapters'
import type {IconType} from '../../common-adapters/icon'
import type {Time} from '../../constants/types/rpc-gen'
import {globalStyles, globalColors, globalMargins, platformStyles, styleSheetCreate} from '../../styles'

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

const TimelineMarker = ({idx, max, type}) => (
  <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>
    <Box style={{...styles.line, height: 6, opacity: idx ? 1 : 0}} />
    <Box style={type === 'Revoked' ? styles.circleClosed : styles.circleOpen} />
    <Box style={{...styles.line, flex: 1, opacity: idx < max ? 1 : 0}} />
  </Box>
)

const TimelineLabel = ({idx, max, desc, subDesc, type}) => (
  <VBox style={styles.timeLabel}>
    <Text type="Body">{desc}</Text>
    {subDesc && (type === 'Added' || type === 'Revoked') ? (
      <Text type="BodySmall">
        by{' '}
        <Text type="BodySmall" style={{color: globalColors.black_75, fontStyle: 'italic'}}>
          {subDesc}
        </Text>
      </Text>
    ) : (
      <Text type="BodySmall">{subDesc}</Text>
    )}
    {idx < max && <Box style={{height: 15}} />}
  </VBox>
)

const Timeline = ({timeline}) =>
  timeline ? (
    <VBox>
      {timeline.map(({type, desc, subDesc}, idx) => (
        <HBox key={desc} gap={16}>
          <TimelineMarker idx={idx} max={timeline.length - 1} type={type} />
          <TimelineLabel idx={idx} max={timeline.length - 1} desc={desc} subDesc={subDesc} type={type} />
        </HBox>
      ))}
    </VBox>
  ) : null

const Render = (props: Props) => {
  let metaOne
  if (props.currentDevice) {
    metaOne = 'Current device'
  } else if (props.revokedAt) {
    metaOne = <Meta title="REVOKED" style={styles.meta} />
  }

  return (
    <StandardScreen
      style={{...globalStyles.flexBoxColumn, alignItems: 'center', flexGrow: 1}}
      onBack={props.onBack}
    >
      <VBox gap={15}>
        <NameWithIcon icon={props.icon} title={props.name} metaOne={metaOne} />
        <Timeline timeline={props.timeline} />
        {!props.revokedAt && (
          <Button
            type="Danger"
            label={`Revoke this ${props.revokeName || ''}`}
            onClick={props.showRevokeDevicePage}
          />
        )}
      </VBox>
    </StandardScreen>
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
  iconHeaderContainer: platformStyles({
    isElectron: {
      alignSelf: 'flex-start',
      padding: 30,
    },
  }),
  line: {
    backgroundColor: globalColors.lightGrey2,
    width: 2,
  },
  meta: {
    alignSelf: 'center',
    backgroundColor: globalColors.red,
    marginTop: 4,
  },
  timeLabel: {alignItems: 'flex-start'},
  title: titleCommon,
  titleRevoked: {
    ...titleCommon,
    color: globalColors.black_40,
    textDecorationLine: 'line-through',
  },
})

export default Render
