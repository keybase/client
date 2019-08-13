import * as React from 'react'
import {
  Avatar,
  Box2,
  ConnectedUsernames,
  FloatingMenu,
  HOCTimers,
  Icon,
  MenuItems,
  ProgressIndicator,
  Text,
  PropsWithTimer,
  PopupHeaderText,
} from '../../../../../common-adapters/'
import * as Styles from '../../../../../styles'
import {formatTimeForPopup, formatTimeForRevoked, msToDHMS} from '../../../../../util/timestamp'
import {addTicker, removeTicker, TickerID} from '../../../../../util/second-timer'
import {DeviceType} from '../../../../../constants/types/devices'
import {Position} from '../../../../../common-adapters/relative-popup-hoc.types'

const headerIconType = Styles.isMobile ? 'icon-fancy-bomb-mobile-226-96' : 'icon-fancy-bomb-desktop-150-72'
const headerIconHeight = Styles.isMobile ? 96 : 72

type Props = {
  attachTo?: () => React.Component<any> | null
  author: string
  deviceName: string
  deviceRevokedAt: number | null
  deviceType: DeviceType
  explodesAt: number
  hideTimer: boolean
  items: MenuItems
  onHidden: () => void
  position: Position
  style?: Styles.StylesCrossPlatform
  timestamp: number
  visible: boolean
  yourMessage: boolean
}

type State = {
  secondsLeft: number
}

class ExplodingPopupHeader extends React.Component<PropsWithTimer<Props>, State> {
  timer?: TickerID
  state = {
    secondsLeft: this.secondsLeft(),
  }

  componentDidMount() {
    if (!__STORYBOOK__) {
      this.timer = addTicker(this.tick)
    }
  }

  componentWillUnmount() {
    this.timer && removeTicker(this.timer)
  }

  secondsLeft() {
    const now = __STORYBOOK__ ? 1999999999000 : Date.now()
    let secondsLeft = Math.floor((this.props.explodesAt - now) / 1000)
    if (secondsLeft < 0) {
      // TODO remove if we end up w/ an "exploded" popup
      this.props.onHidden()
      secondsLeft = 0
    }
    return secondsLeft
  }

  tick = () => {
    this.setState({secondsLeft: this.secondsLeft()})
  }

  render() {
    const {author, deviceName, deviceRevokedAt, hideTimer, timestamp, yourMessage} = this.props
    const whoRevoked = yourMessage ? 'You' : author
    return (
      <Box2 direction="vertical" fullWidth={true} style={styles.popupContainer}>
        <Icon style={styles.headerIcon} type={headerIconType} />
        <Box2 direction="vertical" style={styles.messageInfoContainer}>
          <Box2 direction="vertical">
            <Text type="BodySmall" style={{color: Styles.globalColors.black}}>
              EXPLODING MESSAGE
            </Text>
          </Box2>
          <Box2 direction="horizontal">
            <Text type="BodySmall">by</Text>
            <Box2 direction="horizontal" gap="xtiny" gapStart={true} style={styles.user}>
              <Avatar username={author} size={16} onClick="profile" />
              <ConnectedUsernames
                onUsernameClicked="profile"
                colorFollowing={true}
                colorYou={true}
                usernames={[author]}
                underline={true}
                type="BodySmallSemibold"
              />
            </Box2>
          </Box2>
          <Box2 direction="horizontal">
            <Text center={true} type="BodySmall">
              from device {deviceName}
            </Text>
          </Box2>
          <Box2 direction="horizontal">
            <Text center={true} type="BodySmall">
              using exploding key
            </Text>
          </Box2>
          <Box2 direction="horizontal">
            <Text center={true} type="BodySmall">
              {formatTimeForPopup(timestamp)}
            </Text>
          </Box2>
        </Box2>
        {!!deviceRevokedAt && (
          <PopupHeaderText
            color={Styles.globalColors.white}
            backgroundColor={Styles.globalColors.blue}
            style={styles.revokedAt}
          >
            {whoRevoked} revoked this device on {formatTimeForRevoked(deviceRevokedAt)}.
          </PopupHeaderText>
        )}
        <Box2
          direction="vertical"
          gap="xsmall"
          fullWidth={true}
          gapEnd={true}
          gapStart={true}
          style={Styles.collapseStyles([
            styles.timerBox,
            {
              backgroundColor:
                this.state.secondsLeft < oneMinuteInS ? Styles.globalColors.red : Styles.globalColors.black,
            },
          ])}
        >
          {hideTimer ? (
            <ProgressIndicator white={true} style={{height: 17, width: 17}} />
          ) : (
            <Box2 direction="horizontal" gap="tiny" gapStart={true} gapEnd={true}>
              <Icon
                type="iconfont-timer"
                fontSize={Styles.isMobile ? 20 : 16}
                color={Styles.globalColors.white}
              />
              <Text style={{alignSelf: 'center', color: Styles.globalColors.white}} type="BodySemibold">
                {msToDHMS(this.props.explodesAt - Date.now())}
              </Text>
            </Box2>
          )}
        </Box2>
      </Box2>
    )
  }
}

const ExplodingPopupMenu = (props: PropsWithTimer<Props>) => {
  const header = {
    style: {
      paddingBottom: 0,
      paddingTop: 24,
    },
    title: 'header',
    view: <ExplodingPopupHeader {...props} />,
  }

  return (
    <FloatingMenu
      attachTo={props.attachTo}
      closeOnSelect={true}
      header={header}
      items={props.items}
      onHidden={props.onHidden}
      position={props.position}
      positionFallbacks={[]}
      containerStyle={props.style}
      visible={props.visible}
    />
  )
}

const oneMinuteInS = 60

const styles = Styles.styleSheetCreate({
  headerIcon: {
    height: headerIconHeight,
    marginBottom: Styles.globalMargins.small,
    marginTop: Styles.globalMargins.small,
  },
  messageInfoContainer: {
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
  },
  popupContainer: Styles.platformStyles({
    common: {
      alignItems: 'center',
    },
    isElectron: {
      maxWidth: 240,
      minWidth: 200,
    },
  }),
  revokedAt: {
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    marginBottom: -Styles.globalMargins.small,
    marginTop: Styles.globalMargins.small,
    minHeight: 40,
    width: '100%',
  },
  timerBox: Styles.platformStyles({
    common: {
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: Styles.globalMargins.tiny,
    },
    isMobile: {
      height: 46,
    },
  }),
  user: {
    alignItems: 'center',
  },
})

export default HOCTimers(ExplodingPopupMenu)
