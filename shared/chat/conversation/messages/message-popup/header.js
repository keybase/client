// @flow
import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import {formatTimeForPopup, formatTimeForRevoked} from '../../../../util/timestamp'
import {isAndroid} from '../../../../constants/platform'
import type {DeviceType} from '../../../../constants/types/devices'

const iconNameForDeviceType = Styles.isMobile
  ? (deviceType: string, isRevoked: boolean): Kb.IconType => {
      switch (deviceType) {
        case 'mobile':
          return isRevoked ? 'icon-fancy-revoked-phone-183-x-96' : 'icon-fancy-encrypted-phone-183-x-96'
        default:
          return isRevoked ? 'icon-fancy-revoked-computer-226-x-96' : 'icon-fancy-encrypted-computer-226-x-96'
      }
    }
  : (deviceType: string, isRevoked: boolean): Kb.IconType => {
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
    <Kb.Box style={styles.headerContainer}>
      <Kb.Icon type={iconName} style={Kb.iconCastPlatformStyles(styles.headerIcon)} />
      <Kb.Box style={Styles.globalStyles.flexBoxRow}>
        <Kb.Text
          type="BodySmall"
          style={{color: deviceRevokedAt ? Styles.globalColors.black_40 : Styles.globalColors.green2}}
        >
          ENCRYPTED
        </Kb.Text>
        <Kb.Text
          type="BodySmall"
          style={{color: deviceRevokedAt ? Styles.globalColors.black_40 : Styles.globalColors.green2}}
        >
          &nbsp;& SIGNED
        </Kb.Text>
      </Kb.Box>
      <Kb.Box2 direction="horizontal">
        <Kb.Text type="BodySmall" style={styles.colorBlack40}>
          by
        </Kb.Text>
        <Kb.Box2 direction="horizontal" gap="xtiny" gapStart={true} style={styles.alignItemsCenter}>
          <Kb.Avatar username={author} size={16} clickToProfile="tracker" />
          <Kb.ConnectedUsernames
            onUsernameClicked="profile"
            colorFollowing={true}
            colorYou={true}
            usernames={[author]}
            underline={true}
            type="BodySmallSemibold"
          />
        </Kb.Box2>
      </Kb.Box2>
      <Kb.Box style={styles.headerDetailsContainer}>
        <Kb.Text type="BodySmall">
          from device&nbsp;
          <Kb.Text type="BodySmallSemibold">{deviceName}</Kb.Text>
        </Kb.Text>
      </Kb.Box>
      <Kb.Text type="BodySmall">{formatTimeForPopup(timestamp)}</Kb.Text>
      {deviceRevokedAt && (
        <Kb.Box2
          gap="small"
          fullWidth={true}
          gapStart={true}
          direction="vertical"
          style={Styles.collapseStyles([isLast && styles.revokedAtContainerLast])}
        >
          <Kb.PopupHeaderText color={Styles.globalColors.white} backgroundColor={Styles.globalColors.blue}>
            {whoRevoked} revoked this device on {formatTimeForRevoked(deviceRevokedAt)}.
          </Kb.PopupHeaderText>
        </Kb.Box2>
      )}
    </Kb.Box>
  )
}

// The mobile special casing below is because RN doesn't support overflow on Android
const iconSpacing = Styles.isMobile ? 96 - (isAndroid ? 16 : 30) : 64
const styles = Styles.styleSheetCreate({
  alignItemsCenter: {alignItems: 'center'},
  colorBlack40: {color: Styles.globalColors.black_40},
  headerContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
      alignItems: 'center',
      width: '100%',
    },
    isElectron: {
      maxWidth: 240,
      paddingTop: iconSpacing,
    },
    isMobile: {
      paddingBottom: Styles.globalMargins.medium,
      paddingTop: Styles.globalMargins.medium + iconSpacing,
    },
  }),
  headerDetailsContainer: {
    ...Styles.globalStyles.flexBoxRow,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
  },
  headerIcon: Styles.platformStyles({
    common: {
      marginBottom: Styles.globalMargins.tiny,
      position: 'absolute',
    },
    isAndroid: {
      top: 0,
    },
    isElectron: {marginTop: Styles.globalMargins.small, top: -25},
    isIOS: {top: -15},
    isMobile: {
      marginTop: 0,
    },
  }),
  revokedAtContainerLast: {
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    marginBottom: -Styles.globalMargins.small,
    overflow: 'hidden',
  },
})

export default MessagePopupHeader
