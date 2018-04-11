// @flow
import * as React from 'react'
import type {IconType} from '../../common-adapters/icon'
import type {Time} from '../../constants/types/rpc-gen'
import {Meta, NameWithIcon, StandardScreen, Box, Text, Button, VBox, HBox} from '../../common-adapters'
import {globalStyles, globalColors, platformStyles, styleSheetCreate} from '../../styles'

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
  <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>
    <Box style={{...styles.line, height: 6, opacity: first ? 0 : 1}} />
    <Box style={closedCircle ? styles.circleClosed : styles.circleOpen} />
    <Box style={{...styles.line, flex: 1, opacity: last ? 0 : 1}} />
  </Box>
)

const TimelineLabel = ({desc, subDesc, subDescIsName, spacerOnBottom}) => (
  <VBox style={styles.timeLabel}>
    <Text type="Body">{desc}</Text>
    {subDesc &&
      subDescIsName && (
        <Text type="BodySmall">
          by{' '}
          <Text type="BodySmall" style={{color: globalColors.black_75, fontStyle: 'italic'}}>
            {subDesc}
          </Text>
        </Text>
      )}
    {subDesc && !subDescIsName && <Text type="BodySmall">{subDesc}</Text>}
    {spacerOnBottom && <Box style={{height: 15}} />}
  </VBox>
)

const Timeline = ({timeline}) =>
  timeline ? (
    <VBox>
      {timeline.map(({type, desc, subDesc}, idx) => (
        <HBox key={desc} gap={16}>
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
    <StandardScreen style={styles.container} onBack={props.onBack}>
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
  container: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
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
