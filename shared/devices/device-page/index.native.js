// @flow
import * as React from 'react'
import {StandardScreen, Box, Text, Icon, Button} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins, platformStyles} from '../../styles'
import type {Props} from '.'

// TODO remove this for a common banner
const Banner = ({color, backgroundColor, desc}) => (
  <Text type="BodySemibold" style={{...stylesBanner, backgroundColor, color}}>
    {desc}
  </Text>
)

const Header = ({name, isCurrent, isRevoked}) => (
  <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', marginBottom: 20, marginTop: 10}}>
    <Text type="Header" style={isRevoked ? styleTitleRevoked : styleTitle}>
      {name}
    </Text>
    {isRevoked && (
      <Text type="Header" style={stylesMeta}>
        REVOKED
      </Text>
    )}
    <Box style={globalStyles.flexBoxRow}>{isCurrent && <Text type="BodySmall">Current device</Text>}</Box>
  </Box>
)

const TimelineMarker = ({idx, max, type}) => (
  <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', marginRight: 16}}>
    <Box style={{...stylesLine, height: 8, opacity: idx ? 1 : 0}} />
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
    {!!props.bannerDesc && (
      <Banner
        color={props.bannerColor}
        backgroundColor={props.bannerBackgroundColor}
        desc={props.bannerDesc}
      />
    )}
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

const stylesBanner = {
  alignSelf: 'stretch',
  minHeight: 48,
  paddingBottom: globalMargins.tiny,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
  paddingTop: globalMargins.tiny,
  textAlign: 'center',
}

const styleTitle = {
  fontStyle: 'italic',
  textAlign: 'center',
}

const styleTitleRevoked = {
  ...styleTitle,
  color: globalColors.black_40,
  textDecorationLine: 'line-through',
}

const circleSize = 8

const stylesCircleOpen = {
  borderColor: globalColors.lightGrey2,
  borderRadius: circleSize / 2,
  borderWidth: 2,
  height: circleSize,
  width: circleSize,
}

const stylesCircleClosed = {
  ...stylesCircleOpen,
  backgroundColor: globalColors.lightGrey2,
  borderColor: globalColors.white,
}

const stylesLine = {
  backgroundColor: globalColors.lightGrey2,
  width: 2,
}

const stylesMeta = platformStyles({
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
})

export default Render
