// @flow

import React from 'react'
import type {Props, BannerItem} from './index.render'
import {Box, Text, Icon, Button} from '../../common-adapters'
import {globalStyles, globalColors} from '../../styles/style-guide'
import type {Props as IconProps} from '../../common-adapters/icon'

const Banner = ({type, desc}: BannerItem) => { // eslint-disabled-line arrow-parens
  const backgroundColor = {
    'OutOfDate': globalColors.yellow,
    'WillUnlock': globalColors.blue
  }[type]

  const color = {
    'OutOfDate': globalColors.brown60,
    'WillUnlock': globalColors.white
  }[type]

  return <Box style={{...stylesBanner, backgroundColor}}><Text type='BodySmall' style={{color}}>{desc}</Text></Box>
}

const Header = ({name, isCurrent, isRevoked}) => {
  const textStyle = isRevoked ? {textDecoration: 'line-through', color: globalColors.black40, fontStyle: 'italic'} : {fontStyle: 'italic'}

  return (
    <Box style={{...globalStyles.flexBoxColumn, alignItems: 'flex-start'}}>
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
        <TimelineMarker idx={idx} max={timeline.length - 1}/>
        <Box style={{...globalStyles.flexBoxColumn}}>
          <Text type='Body'>{desc}</Text>
          <Text type='BodySmall'>{subDesc}</Text>
          <Box style={{height: 15}}/>
        </Box>
      </Box>
    ))}
  </Box>
)

const Render = ({banner, name, type, isCurrent, timeline, isRevoked, onRevoke}: Props) => {
  const icon: IconProps.type = {
    'mobile': 'phone-big',
    'desktop': 'computer-big',
    'paperKey': 'paper-key-l'
  }[type]

  const revokeName = {
    'mobile': 'device',
    'desktop': 'device',
    'paperKey': 'paper key'
  }[type]

  return (
    <Box style={{...globalStyles.flexBoxColumn}}>
      {(banner != null) && <Banner type={banner.type} desc={banner.desc}/>}
      <Box style={{...globalStyles.flexBoxRow, padding: 30}}>
        <Box style={{...globalStyles.flexBoxRow, width: 180, justifyContent: 'center', alignItems: 'flex-start'}}>
          <Icon type={icon} style={{opacity: isRevoked ? 0.4 : 1}}/>
        </Box>
        <Box style={{...globalStyles.flexBoxColumn}}>
          <Header name={name} isCurrent={isCurrent} isRevoked={isRevoked}/>
          <Timeline timeline={timeline}/>
          {!isRevoked && <Button type='Danger' style={{marginTop: 15}} label={`Revoke this ${revokeName}`} onClick={onRevoke}/>}
        </Box>
      </Box>
    </Box>)
}

const stylesBanner = {
  ...globalStyles.flexBoxRow,
  flex: 1,
  height: 45,
  justifyContent: 'center',
  alignItems: 'center'
}

const circleSize = 8

const stylesCircle = {
  border: `solid 2px ${globalColors.lightGrey2}`,
  borderRadius: circleSize / 2,
  width: circleSize,
  height: circleSize
}

const stylesLine = {
  width: 2,
  backgroundColor: globalColors.lightGrey2
}

const stylesMeta = {
  backgroundColor: globalColors.red,
  color: globalColors.white,
  borderRadius: 1,
  fontSize: 10,
  height: 11,
  lineHeight: '11px',
  paddingLeft: 2,
  paddingRight: 2,
  textTransform: 'uppercase'
}

export default Render
