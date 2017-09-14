// @flow
import * as React from 'react'
import {Box, Icon, Text} from '../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../styles'
import {isMobile} from '../../constants/platform'

export type Props = {
  onReadMore: () => void,
  onHideBanner: () => void,
}

const Banner = ({onReadMore, onHideBanner}: Props) => (
  <Box
    style={{
      ...(isMobile
        ? {
            ...globalStyles.flexBoxColumn,
            padding: 24,
          }
        : {
            ...globalStyles.flexBoxRow,
            height: 212,
          }),
      alignItems: 'center',
      backgroundColor: globalColors.blue,
      flexShrink: 0,
      justifyContent: 'center',
      position: 'relative',
      width: '100%',
    }}
  >
    <Icon type={isMobile ? 'icon-illustration-teams-216' : 'icon-illustration-teams-180'} />
    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        ...(isMobile ? {alignItems: 'center'} : {marginLeft: globalMargins.medium, maxWidth: 330}),
      }}
    >
      <Text
        backgroundMode="Terminal"
        type="Header"
        style={{
          marginBottom: 15,
          marginTop: 15,
        }}
      >
        Now supporting teams!
      </Text>
      <Text
        backgroundMode="Terminal"
        type="BodySemibold"
        style={{marginBottom: globalMargins.small, ...(isMobile ? {textAlign: 'center'} : {})}}
      >
        Keybase team chats are encrypted - unlike Slack - and work for any size group, from casual friends to large communities.
      </Text>
      <Text backgroundMode="Terminal" type="BodySemiboldLink" className="underline" onClick={onReadMore}>
        Read our announcement
      </Text>
    </Box>
    <Box
      style={{
        ...closeIconStyle,
      }}
    >
      <Icon type="iconfont-close" onClick={onHideBanner} />
    </Box>
  </Box>
)

let closeIconStyle = isMobile
  ? {
      position: 'absolute',
      right: globalMargins.small,
      top: globalMargins.small,
      height: 14,
      width: 14,
    }
  : {
      position: 'absolute',
      right: globalMargins.tiny,
      top: globalMargins.tiny,
    }

export default Banner
