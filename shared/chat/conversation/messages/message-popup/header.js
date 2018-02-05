// @flow
import * as React from 'react'
import {Box, Icon, Text} from '../../../../common-adapters'
import {PopupHeaderText} from '../../../../common-adapters/popup-menu'
import {globalStyles, globalMargins, globalColors, isMobile} from '../../../../styles'
import {formatTimeForPopup, formatTimeForRevoked} from '../../../../util/timestamp'
import type {MessageText, MessageAttachment} from '../../../../constants/types/chat2'
import type {IconType} from '../../../../common-adapters/icon'

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
  message: MessageText | MessageAttachment,
  isLast?: boolean,
  yourMessage: boolean,
}) => {
  const {message, isLast, yourMessage} = props
  const iconName = iconNameForDeviceType(message.deviceType, !!message.deviceRevokedAt)
  const whoRevoked = yourMessage ? 'You' : message.author
  return (
    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        alignItems: 'center',
        width: '100%',
      }}
    >
      <Icon
        type={iconName}
        style={{
          marginBottom: globalMargins.tiny,
          marginTop: !isMobile ? -globalMargins.tiny : -globalMargins.large,
        }}
      />
      <Box style={globalStyles.flexBoxRow}>
        <Text
          type="BodySmall"
          style={{color: message.deviceRevokedAt ? globalColors.black_40 : globalColors.green2}}
        >
          ENCRYPTED
        </Text>
        <Text
          type="BodySmall"
          style={{color: message.deviceRevokedAt ? globalColors.black_40 : globalColors.green2}}
        >
          &nbsp;& SIGNED
        </Text>
      </Box>
      <Box style={globalStyles.flexBoxRow}>
        <Text type="BodySmall" style={{color: globalColors.black_40}}>
          by
        </Text>
        <Text type="BodySmallItalic" style={{color: globalColors.black_60}}>
          &nbsp;{message.deviceName}
        </Text>
      </Box>
      <Text type="BodySmall" style={{color: globalColors.black_40}}>
        {formatTimeForPopup(message.timestamp)}
      </Text>
      {message.deviceRevokedAt && (
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
          {whoRevoked} revoked this device on {formatTimeForRevoked(message.deviceRevokedAt)}.
        </PopupHeaderText>
      )}
    </Box>
  )
}

export default MessagePopupHeader
