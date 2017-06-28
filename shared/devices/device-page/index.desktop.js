// @flow
import React from 'react'
import {Box, Text, Icon, Button, BackButton} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles'

import type {Props} from '.'

const Banner = ({color, backgroundColor, desc}) => (
  <Box style={{...stylesBanner, backgroundColor}}>
    <Text type="BodySemibold" style={{color}}>{desc}</Text>
  </Box>
)

const Header = ({name, currentDevice, revokedAt}) => (
  <Box style={{...globalStyles.flexBoxColumn, alignItems: 'flex-start'}}>
    <Text
      type="Header"
      style={
        revokedAt
          ? {color: globalColors.black_40, fontStyle: 'italic', textDecoration: 'line-through'}
          : {fontStyle: 'italic'}
      }
    >
      {name}
    </Text>
    {revokedAt && <Text type="Header" style={stylesMeta}>REVOKED</Text>}
    <Box style={globalStyles.flexBoxRow}>
      {currentDevice && <Text type="BodySmall">Current device</Text>}
    </Box>
  </Box>
)

const TimelineMarker = ({idx, max, type}) => (
  <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', marginRight: 16}}>
    <Box style={{...stylesLine, height: 5, opacity: idx ? 1 : 0}} />
    {type === 'Revoked' ? <Box style={stylesCircleClosed} /> : <Box style={stylesCircleOpen} />}
    <Box style={{...stylesLine, flex: 1, opacity: idx < max ? 1 : 0}} />
  </Box>
)

const Timeline = ({timeline}) => (
  <Box style={{marginTop: 30}}>
    {timeline.map(({type, desc, subDesc}, idx) => (
      <Box key={desc} style={globalStyles.flexBoxRow}>
        <TimelineMarker idx={idx} max={timeline.length - 1} type={type} />
        <Box style={globalStyles.flexBoxColumn}>
          <Text type="Body">{desc}</Text>
          {subDesc &&
            (type === 'Added' || type === 'Revoked'
              ? <Text type="BodySmall">
                  by
                  {' '}
                  <Text style={{color: globalColors.black_75, fontStyle: 'italic'}} type="BodySmall">
                    {subDesc}
                  </Text>
                </Text>
              : <Text type="BodySmall">{subDesc}</Text>)}
          <Box style={{height: 15}} />
        </Box>
      </Box>
    ))}
  </Box>
)

const Render = ({
  name,
  type,
  deviceID,
  currentDevice,
  timeline,
  revokedAt,
  showRevokeDevicePage,
  device,
  onBack,
  bannerBackgroundColor,
  bannerColor,
  bannerDesc,
  icon,
  revokeName,
}: Props) => (
  <Box style={globalStyles.flexBoxColumn}>
    <Box style={{...globalStyles.flexBoxColumn, height: 48, justifyContent: 'center', paddingLeft: 16}}>
      <BackButton onClick={onBack} />
    </Box>
    {!!bannerDesc && <Banner color={bannerColor} backgroundColor={bannerBackgroundColor} desc={bannerDesc} />}
    <Box style={{...globalStyles.flexBoxRow, padding: 30}}>
      <Box
        style={{...globalStyles.flexBoxRow, alignItems: 'flex-start', justifyContent: 'center', width: 240}}
      >
        <Icon type={icon} style={{opacity: revokedAt ? 0.4 : 1}} />
      </Box>
      <Box style={globalStyles.flexBoxColumn}>
        <Header name={name} currentDevice={currentDevice} revokedAt={revokedAt} />
        {!!timeline && <Timeline timeline={timeline} />}
        {!revokedAt &&
          <Button
            type="Danger"
            style={{marginTop: 15, alignSelf: 'flex-start'}}
            label={`Revoke this ${revokeName || ''}`}
            onClick={showRevokeDevicePage}
          />}
      </Box>
    </Box>
  </Box>
)

const stylesBanner = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  flex: 1,
  height: 45,
  justifyContent: 'center',
}

const circleSize = 8

const stylesCircleOpen = {
  border: `solid 2px ${globalColors.lightGrey2}`,
  borderRadius: circleSize / 2,
  height: circleSize,
  width: circleSize,
}

const stylesCircleClosed = {
  ...stylesCircleOpen,
  backgroundColor: globalColors.lightGrey2,
  border: `solid 2px ${globalColors.white}`,
}

const stylesLine = {
  backgroundColor: globalColors.lightGrey2,
  width: 2,
}

const stylesMeta = {
  backgroundColor: globalColors.red,
  borderRadius: 1,
  color: globalColors.white,
  fontSize: 10,
  height: 11,
  lineHeight: '11px',
  paddingLeft: 2,
  paddingRight: 2,
  textTransform: 'uppercase',
}

export default Render
