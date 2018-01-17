// @flow
import * as React from 'react'
import {Box, Icon, Text} from '../../common-adapters'
import {globalColors, globalMargins, globalStyles, isMobile} from '../../styles'
import type {Teamname} from '../../constants/types/teams'

export type Props = {
  onReadMore: () => void,
  onHideSubteamsBanner: () => void,
  teamname: Teamname,
}

const Banner = ({onReadMore, onHideSubteamsBanner, teamname}: Props) => (
  <Box
    style={{
      ...(isMobile ? styleMobile : styleDesktop),
      ...styleContainer,
    }}
  >
    <Box style={{...globalStyles.flexBoxColumn, margin: globalMargins.small}}>
      <Icon type="icon-illustration-subteams-380" />
    </Box>

    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        ...(isMobile ? {alignItems: 'center'} : {marginLeft: globalMargins.medium, maxWidth: 330}),
      }}
    >
      <Text
        backgroundMode="Terminal"
        type="BodySemibold"
        style={{marginBottom: globalMargins.small, ...(isMobile ? {textAlign: 'center'} : {})}}
      >
        Subteams are cryptographically distinct, and can welcome people who aren't elsewhere in your team
        hierarchy. Some random ideas:
      </Text>
      <Text backgroundMode="Terminal" type="BodySemibold">
        • {teamname}.devops
      </Text>
      <Text backgroundMode="Terminal" type="BodySemibold">
        • {teamname}.legal
      </Text>
      <Text backgroundMode="Terminal" type="BodySemibold">
        • {teamname}.customers.vip
      </Text>

      <Text
        style={{marginTop: globalMargins.small}}
        backgroundMode="Terminal"
        type="BodySemiboldLink"
        className="underline"
        onClick={onReadMore}
      >
        Read more about subteams
      </Text>
    </Box>
    {onHideSubteamsBanner && (
      <Box style={closeIconStyle}>
        <Icon type="iconfont-close" onClick={onHideSubteamsBanner} />
      </Box>
    )}
  </Box>
)

let closeIconStyle = {
  position: 'absolute',
  ...(isMobile
    ? {
        right: globalMargins.small,
        top: globalMargins.small,
        height: 14,
        width: 14,
      }
    : {
        right: globalMargins.tiny,
        top: globalMargins.tiny,
      }),
}

const styleDesktop = {
  ...globalStyles.flexBoxRow,
  height: 256,
}

const styleMobile = {
  ...globalStyles.flexBoxColumn,
  padding: 24,
}

const styleContainer = {
  alignItems: 'center',
  backgroundColor: globalColors.blue,
  flexShrink: 0,
  justifyContent: 'center',
  position: 'relative',
  width: '100%',
}

export default Banner
