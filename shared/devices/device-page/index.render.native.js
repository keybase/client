// @flow

import React from 'react'
import type {Props, BannerItem} from './index.render'
import {Box, Text, Icon, Button} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles/style-guide'
import type {Props as IconProps} from '../../common-adapters/icon'

const Banner = ({type, desc}: BannerItem) => { // eslint-disabled-line arrow-parens
  const backgroundColor = {
    'OutOfDate': globalColors.yellow,
    'WillUnlock': globalColors.blue,
  }[type]

  const color = {
    'OutOfDate': globalColors.brown_60,
    'WillUnlock': globalColors.white,
  }[type]

  return <Text inline type='BodySmall' style={{...stylesBanner, color, backgroundColor}}>{desc}</Text>
}

const Header = ({name, isCurrent, isRevoked}) => {
  const textStyle = isRevoked ? {textDecorationLine: 'line-through', color: globalColors.black_40, fontStyle: 'italic'} : {fontStyle: 'italic'}

  return (
    <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', marginTop: 10, marginBottom: 20}}>
      <Text type='Header' style={textStyle}>{name}</Text>
      {isRevoked && <Text type='Header' style={stylesMeta}>REVOKED</Text>}
      <Box style={{...globalStyles.flexBoxRow}}>
        {isCurrent && <Text type='BodySmall'>Current device</Text>}
      </Box>
    </Box>
  )
}

const TimelineMarker = ({idx, max}) => (
  <Box style={{...globalStyles.flexBoxColumn, marginRight: 16, alignItems: 'center'}}>
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
            ? <Text type='BodySmall'>by <Text type='BodySmall' style={{fontStyle: 'italic', color: globalColors.black_75}}>{subDesc}</Text></Text>
            : <Text type='BodySmall'>{subDesc}</Text>
          }
          <Box style={{height: 15}} />
        </Box>
      </Box>
    ))}
  </Box>
)

const Render = ({banner, name, type, deviceID, currentDevice, timeline, revokedAt, showRemoveDevicePage, device}: Props) => {
  const icon: IconProps.type = {
    'mobile': 'phone-big',
    'desktop': 'computer-big',
    'backup': 'paper-key-l',
  }[type]

  const revokeName = {
    'mobile': 'device',
    'desktop': 'device',
    'backup': 'paper key',
  }[type]

  return (
    <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center'}}>
      {(banner != null) && <Banner type={banner.type} desc={banner.desc} />}
      <Icon type={icon} style={{opacity: revokedAt ? 0.4 : 1, marginTop: 32}} />
      <Header name={name} isCurrent={currentDevice} isRevoked={revokedAt} />
      {!!timeline && <Timeline timeline={timeline} />}
      {!revokedAt && <Button type='Danger' style={{marginTop: 15}} label={`Revoke this ${revokeName}`} onClick={() => showRemoveDevicePage(device)} />}
    </Box>)
}

const stylesBanner = {
  textAlign: 'center',
  alignSelf: 'stretch',
  padding: 15,
}

const circleSize = 8

const stylesCircle = {
  borderColor: globalColors.lightGrey2,
  borderWidth: 2,
  borderRadius: circleSize / 2,
  width: circleSize,
  height: circleSize,
}

const stylesLine = {
  width: 2,
  backgroundColor: globalColors.lightGrey2,
}

const stylesMeta = {
  backgroundColor: globalColors.red,
  color: globalColors.white,
  borderRadius: 1,
  fontSize: 10,
  height: 11,
  lineHeight: 11,
  paddingLeft: 2,
  paddingRight: 2,
}

export default Render
