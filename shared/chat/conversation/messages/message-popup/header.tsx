import * as Kb from '@/common-adapters'
import * as React from 'react'
import {useProfileState} from '@/stores/profile'
import {formatTimeForPopup, formatTimeForRevoked} from '@/util/timestamp'
import type * as T from '@/constants/types'

const iconNameForDeviceType = Kb.Styles.isMobile
  ? (deviceType: string, isRevoked: boolean, isLocation: boolean): Kb.IconType => {
      switch (deviceType) {
        case 'mobile':
          return isRevoked
            ? 'icon-fancy-revoked-phone-mobile-226-96'
            : isLocation
              ? 'icon-fancy-location-phone-mobile-226-96'
              : 'icon-fancy-encrypted-phone-mobile-226-96'
        default:
          return isRevoked
            ? 'icon-fancy-revoked-computer-mobile-226-96'
            : 'icon-fancy-encrypted-computer-mobile-226-96'
      }
    }
  : (deviceType: string, isRevoked: boolean, isLocation: boolean): Kb.IconType => {
      switch (deviceType) {
        case 'mobile':
          return isRevoked
            ? 'icon-fancy-revoked-phone-desktop-150-72'
            : isLocation
              ? 'icon-fancy-location-phone-desktop-150-72'
              : 'icon-fancy-encrypted-phone-desktop-150-72'
        default:
          return isRevoked
            ? 'icon-fancy-revoked-computer-desktop-150-72'
            : 'icon-fancy-encrypted-computer-desktop-150-72'
      }
    }

const headerIconHeight = Kb.Styles.isMobile ? 96 : 48

type Props = {
  author: string
  botUsername?: string
  deviceName: string
  deviceRevokedAt?: number
  deviceType: T.Devices.DeviceType
  isLast?: boolean
  isLocation: boolean
  timestamp: number
  yourMessage: boolean
  onHidden: () => void
}
const MessagePopupHeader = (props: Props) => {
  const {author, botUsername, deviceName, deviceRevokedAt, deviceType} = props
  const {isLast, isLocation, timestamp, yourMessage, onHidden} = props
  const iconName = iconNameForDeviceType(deviceType, !!deviceRevokedAt, isLocation)
  const whoRevoked = yourMessage ? 'You' : author

  const showUserProfile = useProfileState(s => s.dispatch.showUserProfile)
  const onUsernameClicked = React.useCallback(
    (user: string) => {
      showUserProfile(user)
      onHidden()
    },
    [showUserProfile, onHidden]
  )

  return (
    <Kb.Box style={styles.headerContainer}>
      {Kb.Styles.isMobile ? null : <Kb.Icon type={iconName} style={styles.headerIcon} />}
      {Kb.Styles.isMobile ? null : (
        <Kb.Box style={Kb.Styles.globalStyles.flexBoxRow}>
          <Kb.Text
            type="BodySmall"
            style={{
              color: deviceRevokedAt ? Kb.Styles.globalColors.black_50 : Kb.Styles.globalColors.greenDark,
            }}
          >
            ENCRYPTED & SIGNED
          </Kb.Text>
        </Kb.Box>
      )}
      <Kb.Box2 direction="horizontal">
        <Kb.Box2 direction="horizontal" gap="xtiny" gapStart={true} style={styles.alignItemsCenter}>
          <Kb.Avatar username={author} size={16} onClick="profile" />
          <Kb.ConnectedUsernames
            onUsernameClicked={onUsernameClicked}
            colorFollowing={true}
            colorYou={true}
            usernames={author}
            underline={true}
            type="BodySmallBold"
          />
          <Kb.Text type="BodySmallSemibold">{deviceName}</Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
      {botUsername && (
        <Kb.Box2 direction="horizontal">
          <Kb.Text type="BodySmall">also encrypted for</Kb.Text>
          <Kb.Box2 direction="horizontal" gap="xtiny" gapStart={true} style={styles.alignItemsCenter}>
            <Kb.Avatar username={botUsername} size={16} onClick="profile" />
            <Kb.ConnectedUsernames
              onUsernameClicked="profile"
              colorFollowing={true}
              colorYou={true}
              usernames={botUsername}
              underline={true}
              type="BodySmallBold"
            />
          </Kb.Box2>
        </Kb.Box2>
      )}
      <Kb.Text center={true} type="BodySmall">
        {formatTimeForPopup(timestamp)}
      </Kb.Text>
      {!!deviceRevokedAt && (
        <Kb.Box2
          gap="small"
          fullWidth={true}
          gapStart={true}
          direction="vertical"
          style={Kb.Styles.collapseStyles([isLast && styles.revokedAtContainerLast])}
        >
          <Kb.PopupHeaderText
            color={Kb.Styles.globalColors.white}
            backgroundColor={Kb.Styles.globalColors.blue}
          >
            {whoRevoked} revoked this device on {formatTimeForRevoked(deviceRevokedAt)}.
          </Kb.PopupHeaderText>
        </Kb.Box2>
      )}
      <Kb.Divider
        style={{
          marginBottom: Kb.Styles.isMobile ? Kb.Styles.globalMargins.tiny : 0,
          marginTop: Kb.Styles.globalMargins.tiny,
          width: '100%',
        }}
      />
    </Kb.Box>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      alignItemsCenter: {alignItems: 'center'},
      colorBlack40: {color: Kb.Styles.globalColors.black_50},
      headerContainer: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.globalStyles.flexBoxColumn,
          alignItems: 'center',
          paddingTop: Kb.Styles.globalMargins.tiny,
          width: '100%',
        },
        isElectron: {
          maxWidth: 240,
          minWidth: 200,
        },
      }),
      headerDetailsContainer: {
        ...Kb.Styles.globalStyles.flexBoxRow,
        paddingLeft: Kb.Styles.globalMargins.small,
        paddingRight: Kb.Styles.globalMargins.small,
      },
      headerIcon: Kb.Styles.platformStyles({
        common: {
          height: headerIconHeight,
          marginBottom: Kb.Styles.globalMargins.tiny,
          marginTop: Kb.Styles.globalMargins.tiny,
        },
        isElectron: {marginTop: 0},
        isMobile: {marginTop: Kb.Styles.globalMargins.small},
      }),
      revokedAtContainerLast: {
        borderBottomLeftRadius: 3,
        borderBottomRightRadius: 3,
        marginBottom: -Kb.Styles.globalMargins.small,
        overflow: 'hidden',
      },
    }) as const
)

export default MessagePopupHeader
