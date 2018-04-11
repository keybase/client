// @flow
import * as React from 'react'
import {StandardScreen, Box, Text, Icon, Button} from '../../common-adapters'
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

const Header = ({name, isCurrent, isRevoked}) => (
  <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', marginBottom: 20, marginTop: 10}}>
    <Text type="Header" style={isRevoked ? styles.titleRevoked : styles.title}>
      {name}
    </Text>
    {isRevoked && (
      <Text type="Header" style={styles.meta}>
        REVOKED
      </Text>
    )}
    <Box style={globalStyles.flexBoxRow}>{isCurrent && <Text type="BodySmall">Current device</Text>}</Box>
  </Box>
)

const TimelineMarker = ({idx, max, type}) => (
  <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', marginRight: 16}}>
    <Box style={{...styles.line, height: 8, opacity: idx ? 1 : 0}} />
    <Box style={type === 'Revoked' ? styles.circleClosed : styles.circleOpen} />
    <Box style={{...styles.line, flex: 1, opacity: idx < max ? 1 : 0}} />
  </Box>
)

const Timeline = ({timeline}) => (
  <Box style={{marginTop: 30}}>
    {timeline.map(({type, desc, subDesc}, idx) => (
      <Box key={desc} style={globalStyles.flexBoxRow}>
        <TimelineMarker idx={idx} max={timeline.length - 1} type={type} />
        <Box style={globalStyles.flexBoxColumn}>
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
          <Box style={{height: 15}} />
        </Box>
      </Box>
    ))}
  </Box>
)

const Render = (props: Props) => (
  <StandardScreen
    style={{...globalStyles.flexBoxColumn, alignItems: 'center', flexGrow: 1}}
    onBack={props.onBack}
  >
    <Icon type={props.icon} style={{marginTop: 32, opacity: props.revokedAt ? 0.4 : 1}} />
    <Header name={props.name} isCurrent={props.currentDevice} isRevoked={props.revokedAt} />
    {!!props.timeline && <Timeline timeline={props.timeline} />}
    {!props.revokedAt && (
      <Button
        type="Danger"
        style={{marginTop: globalMargins.small}}
        label={`Revoke this ${props.revokeName || ''}`}
        onClick={props.showRevokeDevicePage}
      />
    )}
  </StandardScreen>
)

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
  line: {
    backgroundColor: globalColors.lightGrey2,
    width: 2,
  },
  meta: platformStyles({
    isMobile: {
      backgroundColor: globalColors.red,
      borderRadius: 2,
      color: globalColors.white,
      fontSize: 12,
      height: 15,
      lineHeight: 15,
      marginTop: globalMargins.xtiny,
      paddingLeft: 2,
      paddingRight: 2,
    },
  }),
  title: {
    ...titleCommon,
  },
  titleRevoked: {
    ...titleCommon,
    color: globalColors.black_40,
    textDecorationLine: 'line-through',
  },
})

export default Render
