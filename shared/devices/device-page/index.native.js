// @flow
import React from 'react'
import {Box, Text, Icon, Button, BackButton, Meta} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'

import type {Props} from '.'

// TODO remove this for a common banner
const Banner = ({color, backgroundColor, desc}) => (
  <Text type='BodySemibold' style={{...stylesBanner, backgroundColor, color}}>{desc}</Text>
)

const Header = ({name, isCurrent, isRevoked}) => (
  <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', marginBottom: 20, marginTop: 10}}>
    <Text type='Header' style={isRevoked
        ? {...stylesHeader, color: globalColors.black_40, textDecorationLine: 'line-through'}
        : stylesHeader}>{name}</Text>
    {isRevoked && <Meta title='REVOKED' styel={stylesMeta} />}
    {isRevoked && <Text type='Header' style={stylesMeta}>REVOKED</Text>}
    <Box style={{...globalStyles.flexBoxRow}}>
      {isCurrent && <Text type='BodySmall'>Current device</Text>}
    </Box>
  </Box>
)

const TimelineMarker = ({idx, max}) => (
  <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', marginRight: 16}}>
    <Box style={{...stylesLine, height: 8, opacity: idx ? 1 : 0}} />
    <Box style={stylesCircle} />
    <Box style={{...stylesLine, flex: 1, opacity: idx < max ? 1 : 0}} />
  </Box>
)

const Timeline = ({timeline}) => (
  <Box style={{marginTop: 30}}>
    {timeline.map(({type, desc, subDesc}, idx) => (
      <Box key={desc} style={{...globalStyles.flexBoxRow}}>
        <TimelineMarker idx={idx} max={timeline.length - 1} />
        <Box style={{...globalStyles.flexBoxColumn}}>
          <Text type='Body'>{desc}</Text>
          {(subDesc && (type === 'Added' || type === 'Revoked'))
            ? <Text type='BodySmall'>by <Text type='BodySmall' style={{color: globalColors.black_75, fontStyle: 'italic'}}>{subDesc}</Text></Text>
            : <Text type='BodySmall'>{subDesc}</Text>
          }
          <Box style={{height: 15}} />
        </Box>
      </Box>
    ))}
  </Box>
)

const Render = ({
  name, type, deviceID, currentDevice, timeline, revokedAt, showRevokeDevicePage, device, onBack, bannerBackgroundColor, bannerColor, bannerDesc, icon, revokeName,
}: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>
    <BackButton style={{alignSelf: 'flex-start', marginLeft: 13, marginTop: 13}} onClick={onBack} />
    {!!bannerDesc && <Banner color={bannerColor} backgroundColor={bannerBackgroundColor} desc={bannerDesc} />}
    <Icon type={icon} style={{marginTop: 32, opacity: revokedAt ? 0.4 : 1}} />
    <Header name={name} isCurrent={currentDevice} isRevoked={revokedAt} />
    {!!timeline && <Timeline timeline={timeline} />}
    {!revokedAt && <Button type='Danger' style={{marginTop: 15}} label={`Revoke this ${revokeName || ''}`} onClick={showRevokeDevicePage} />}
  </Box>
)

const stylesHeader = {
  textAlign: 'center',
  fontStyle: 'italic',
}

const stylesBanner = {
  alignSelf: 'stretch',
  minHeight: 48,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
  paddingTop: globalMargins.tiny,
  paddingBottom: globalMargins.tiny,
  textAlign: 'center',
}

const circleSize = 8

const stylesCircle = {
  borderColor: globalColors.lightGrey2,
  borderRadius: circleSize / 2,
  borderWidth: 2,
  height: circleSize,
  width: circleSize,
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
  lineHeight: 11,
  paddingLeft: 2,
  paddingRight: 2,
}

export default Render
