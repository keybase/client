import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import {formatTimeForPopup, formatTimeForRevoked, msToDHMS} from '../../../../../util/timestamp'
import {addTicker, removeTicker, type TickerID} from '../../../../../util/second-timer'
import {type DeviceType} from '../../../../../constants/types/devices'

const headerIconType = Styles.isMobile ? 'icon-fancy-bomb-mobile-226-96' : 'icon-fancy-bomb-desktop-150-72'
const headerIconHeight = Styles.isMobile ? 96 : 72

type Props = {
  attachTo?: () => React.Component<any> | null
  author: string
  botUsername?: string
  deviceName: string
  deviceRevokedAt?: number
  deviceType: DeviceType
  explodesAt: number
  hideTimer: boolean
  items: Kb.MenuItems
  onHidden: () => void
  position: Styles.Position
  style?: Styles.StylesCrossPlatform
  timestamp: number
  visible: boolean
  yourMessage: boolean
}

type State = {
  secondsLeft: number
}

class ExplodingPopupHeader extends React.Component<Props, State> {
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
      secondsLeft = 0
    }
    return secondsLeft
  }

  tick = () => {
    this.setState({secondsLeft: this.secondsLeft()})
  }

  render() {
    const {author, botUsername, deviceName, deviceRevokedAt, hideTimer, timestamp, yourMessage} = this.props
    const whoRevoked = yourMessage ? 'You' : author
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.popupContainer}>
        <Kb.Icon style={styles.headerIcon} type={headerIconType} />
        <Kb.Box2 direction="vertical" style={styles.messageInfoContainer}>
          <Kb.Box2 direction="vertical">
            <Kb.Text type="BodySmall" style={{color: Styles.globalColors.black}}>
              EXPLODING MESSAGE
            </Kb.Text>
          </Kb.Box2>
          <Kb.Box2 direction="horizontal">
            <Kb.Text type="BodySmall">by</Kb.Text>
            <Kb.Box2 direction="horizontal" gap="xtiny" gapStart={true} style={styles.user}>
              <Kb.Avatar username={author} size={16} onClick="profile" />
              <Kb.ConnectedUsernames
                onUsernameClicked="profile"
                colorFollowing={true}
                colorYou={true}
                usernames={author}
                underline={true}
                type="BodySmallBold"
              />
            </Kb.Box2>
          </Kb.Box2>
          <Kb.Box2 direction="horizontal">
            <Kb.Text center={true} type="BodySmall">
              from device {deviceName}
            </Kb.Text>
          </Kb.Box2>
          {botUsername && (
            <Kb.Box2 direction="horizontal">
              <Kb.Text type="BodySmall">also encrypted for</Kb.Text>
              <Kb.Box2 direction="horizontal" gap="xtiny" gapStart={true} style={{alignItems: 'center'}}>
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
          <Kb.Box2 direction="horizontal">
            <Kb.Text center={true} type="BodySmall">
              using exploding key
            </Kb.Text>
          </Kb.Box2>
          <Kb.Box2 direction="horizontal">
            <Kb.Text center={true} type="BodySmall">
              {formatTimeForPopup(timestamp)}
            </Kb.Text>
          </Kb.Box2>
        </Kb.Box2>
        {!!deviceRevokedAt && (
          <Kb.PopupHeaderText
            color={Styles.globalColors.white}
            backgroundColor={Styles.globalColors.blue}
            style={styles.revokedAt}
          >
            {whoRevoked} revoked this device on {formatTimeForRevoked(deviceRevokedAt)}.
          </Kb.PopupHeaderText>
        )}
        <Kb.Box2
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
            <Kb.ProgressIndicator white={true} style={{height: 17, width: 17}} />
          ) : (
            <Kb.Box2 direction="horizontal" gap="tiny" gapStart={true} gapEnd={true}>
              <Kb.Icon
                type="iconfont-timer"
                fontSize={Styles.isMobile ? 20 : 16}
                color={Styles.globalColors.white}
              />
              <Kb.Text style={{alignSelf: 'center', color: Styles.globalColors.white}} type="BodySemibold">
                {msToDHMS(this.props.explodesAt - Date.now())}
              </Kb.Text>
            </Kb.Box2>
          )}
        </Kb.Box2>
      </Kb.Box2>
    )
  }
}

const ExplodingPopupMenu = (props: Props) => {
  const header = <ExplodingPopupHeader {...props} />

  return (
    <Kb.FloatingMenu
      attachTo={props.attachTo}
      closeOnSelect={true}
      header={header}
      items={props.items}
      onHidden={props.onHidden}
      position={props.position}
      positionFallbacks={[]}
      containerStyle={props.style}
      visible={props.visible}
      safeProviderStyle={safeProviderStyle}
    />
  )
}

const safeProviderStyle = {flex: 1} as const

const oneMinuteInS = 60

const styles = Styles.styleSheetCreate(
  () =>
    ({
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
    } as const)
)

export default ExplodingPopupMenu
