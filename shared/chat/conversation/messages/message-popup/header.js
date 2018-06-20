// @flow
import * as React from 'react'
import {Avatar, Box, Box2, ConnectedUsernames, Icon, Text, type IconType} from '../../../../common-adapters'
import {PopupHeaderText} from '../../../../common-adapters/popup-menu'
import {globalStyles, globalMargins, globalColors, isMobile} from '../../../../styles'
import {formatTimeForPopup, formatTimeForRevoked} from '../../../../util/timestamp'
import type {DeviceType} from '../../../../constants/types/devices'

const iconNameForDeviceType = isMobile
  ? (deviceType: string, isRevoked: boolean): IconType => {
      switch (deviceType) {
        case 'mobile':
          return isRevoked ? 'icon-fancy-revoked-phone-183-x-96' : 'icon-fancy-encrypted-phone-183-x-96'
        default:
          return isRevoked ? 'icon-fancy-revoked-computer-226-x-96' : 'icon-fancy-encrypted-computer-226-x-96'
      }
    }
  : (deviceType: string, isRevoked: boolean): IconType => {
      switch (deviceType) {
        case 'mobile':
          return isRevoked ? 'icon-fancy-revoked-phone-122-x-64' : 'icon-fancy-encrypted-phone-122-x-64'
        default:
          return isRevoked ? 'icon-fancy-revoked-computer-150-x-64' : 'icon-fancy-encrypted-computer-150-x-64'
      }
    }

const MessagePopupHeader = (props: {
  author: string,
  deviceName: string,
  deviceRevokedAt: ?number,
  deviceType: DeviceType,
  isLast?: boolean,
  timestamp: number,
  yourMessage: boolean,
}) => {
  const {author, deviceName, deviceRevokedAt, deviceType, isLast, timestamp, yourMessage} = props
  const iconName = iconNameForDeviceType(deviceType, !!deviceRevokedAt)
  const whoRevoked = yourMessage ? 'You' : author
  return (
    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        alignItems: 'center',
        maxWidth: isMobile ? '100%' : 240,
        textAlign: 'center',
        width: '100%',
      }}
    >
      <Icon
        type={iconName}
        style={{
          marginBottom: globalMargins.tiny,
          marginTop: !isMobile ? globalMargins.small : 0,
        }}
      />
      <Box
        style={{
          ...globalStyles.flexBoxRow,
        }}
      >
        <Text type="BodySmall" style={{color: deviceRevokedAt ? globalColors.black_40 : globalColors.green2}}>
          ENCRYPTED
        </Text>
        <Text type="BodySmall" style={{color: deviceRevokedAt ? globalColors.black_40 : globalColors.green2}}>
          &nbsp;& SIGNED
        </Text>
      </Box>
      <Box2 direction="horizontal">
        <Text type="BodySmall" style={{color: globalColors.black_40}}>
          by
        </Text>
        <Box2 direction="horizontal" gap="xtiny" gapStart={true} style={{alignItems: 'center'}}>
          <Avatar username={author} size={16} clickToProfile="tracker" />
          <ConnectedUsernames
            clickable={true}
            colorFollowing={true}
            colorYou={true}
            usernames={[author]}
            underline={true}
            type="BodySmallSemibold"
          />
        </Box2>
      </Box2>
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          paddingLeft: globalMargins.small,
          paddingRight: globalMargins.small,
        }}
      >
        <Text type="BodySmall">
          using device&nbsp;<Text type="BodySmallSemibold">{deviceName}</Text>
        </Text>
      </Box>
      <Text type="BodySmall">{formatTimeForPopup(timestamp)}</Text>
      {deviceRevokedAt && (
        <PopupHeaderText
          color={globalColors.white}
          backgroundColor={globalColors.blue}
          style={{
            marginTop: globalMargins.small,
            ...(isLast
              ? {borderBottomLeftRadius: 3, borderBottomRightRadius: 3, marginBottom: -globalMargins.small}
              : {}),
            width: '100%',
          }}
        >
          {whoRevoked} revoked this device on {formatTimeForRevoked(deviceRevokedAt)}.
        </PopupHeaderText>
      )}
    </Box>
  )
}

export default MessagePopupHeader
