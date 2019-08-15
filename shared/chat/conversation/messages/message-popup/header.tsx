import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import {formatTimeForPopup, formatTimeForRevoked} from '../../../../util/timestamp'
import {DeviceType} from '../../../../constants/types/devices'

const iconNameForDeviceType = Styles.isMobile
  ? (deviceType: string, isRevoked: boolean): Kb.IconType => {
      switch (deviceType) {
        case 'mobile':
          return isRevoked
            ? 'icon-fancy-revoked-phone-mobile-226-96'
            : 'icon-fancy-encrypted-phone-mobile-226-96'
        default:
          return isRevoked
            ? 'icon-fancy-revoked-computer-mobile-226-96'
            : 'icon-fancy-encrypted-computer-mobile-226-96'
      }
    }
  : (deviceType: string, isRevoked: boolean): Kb.IconType => {
      switch (deviceType) {
        case 'mobile':
          return isRevoked
            ? 'icon-fancy-revoked-phone-desktop-150-72'
            : 'icon-fancy-encrypted-phone-desktop-150-72'
        default:
          return isRevoked
            ? 'icon-fancy-revoked-computer-desktop-150-72'
            : 'icon-fancy-encrypted-computer-desktop-150-72'
      }
    }

const headerIconHeight = Styles.isMobile ? 96 : 72

const MessagePopupHeader = (props: {
  author: string
  deviceName: string
  deviceRevokedAt?: number
  deviceType: DeviceType
  isLast?: boolean
  timestamp: number
  yourMessage: boolean
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
          style={{color: deviceRevokedAt ? Styles.globalColors.black_50 : Styles.globalColors.greenDark}}
        >
          ENCRYPTED
        </Kb.Text>
        <Kb.Text
          type="BodySmall"
          style={{color: deviceRevokedAt ? Styles.globalColors.black_50 : Styles.globalColors.greenDark}}
        >
          &nbsp;& SIGNED
        </Kb.Text>
      </Kb.Box>
      <Kb.Box2 direction="horizontal">
        <Kb.Text type="BodySmall" style={styles.colorBlack40}>
          by
        </Kb.Text>
        <Kb.Box2 direction="horizontal" gap="xtiny" gapStart={true} style={styles.alignItemsCenter}>
          <Kb.Avatar username={author} size={16} onClick="profile" />
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
        <Kb.Text center={true} type="BodySmall">
          from device&nbsp;
          <Kb.Text type="BodySmallSemibold">{deviceName}</Kb.Text>
        </Kb.Text>
      </Kb.Box>
      <Kb.Text center={true} type="BodySmall">
        {formatTimeForPopup(timestamp)}
      </Kb.Text>
      {!!deviceRevokedAt && (
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

const styles = Styles.styleSheetCreate({
  alignItemsCenter: {alignItems: 'center'},
  colorBlack40: {color: Styles.globalColors.black_50},
  headerContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
      alignItems: 'center',
      width: '100%',
    },
    isElectron: {
      maxWidth: 240,
      minWidth: 200,
      paddingTop: Styles.globalMargins.small,
    },
    isMobile: {
      paddingBottom: Styles.globalMargins.medium,
      paddingTop: Styles.globalMargins.medium,
    },
  }),
  headerDetailsContainer: {
    ...Styles.globalStyles.flexBoxRow,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
  },
  headerIcon: Styles.platformStyles({
    common: {
      height: headerIconHeight,
      marginBottom: Styles.globalMargins.small,
      marginTop: Styles.globalMargins.small,
    },
    isElectron: {marginTop: Styles.globalMargins.tiny},
    isMobile: {
      marginTop: Styles.globalMargins.small,
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
