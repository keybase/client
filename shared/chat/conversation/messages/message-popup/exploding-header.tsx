import * as React from 'react'
import * as Kb from '@/common-adapters'
import {formatTimeForPopup, formatTimeForRevoked, msToDHMS} from '@/util/timestamp'
import {addTicker, removeTicker, type TickerID} from '@/util/second-timer'

type Props = {
  explodesAt: number
  author: string
  botUsername?: string
  deviceName: string
  deviceRevokedAt?: number
  hideTimer: boolean
  timestamp: number
  yourMessage: boolean
}
type State = {secondsLeft: number}

class ExplodingPopupHeader extends React.Component<Props, State> {
  timer?: TickerID
  state = {secondsLeft: this.secondsLeft()}

  componentDidMount() {
    this.timer = addTicker(this.tick)
  }

  componentWillUnmount() {
    this.timer && removeTicker(this.timer)
  }

  secondsLeft() {
    const now = Date.now()
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
    const {author, botUsername, deviceName, deviceRevokedAt, hideTimer, timestamp} = this.props
    const icon = <Kb.Icon style={styles.headerIcon} type={headerIconType} />
    const info = (
      <Kb.Box2 direction="vertical" style={styles.messageInfoContainer} fullWidth={true}>
        <Kb.Box2 direction="horizontal">
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
            <Kb.Text center={true} type="BodySmall">
              {deviceName}
            </Kb.Text>
          </Kb.Box2>
        </Kb.Box2>
        {botUsername ? (
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
        ) : null}
        <Kb.Box2 direction="vertical" fullWidth={true}>
          <Kb.Text center={true} type="BodySmall">
            {formatTimeForPopup(timestamp)}
          </Kb.Text>
          {deviceRevokedAt ? (
            <Kb.PopupHeaderText
              color={Kb.Styles.globalColors.white}
              backgroundColor={Kb.Styles.globalColors.blue}
              style={styles.revokedAt}
            >
              Device revoked on {formatTimeForRevoked(deviceRevokedAt)}
            </Kb.PopupHeaderText>
          ) : null}
        </Kb.Box2>
      </Kb.Box2>
    )

    const banner = (
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        style={Kb.Styles.collapseStyles([
          styles.timerBox,
          {
            backgroundColor:
              this.state.secondsLeft < oneMinuteInS
                ? Kb.Styles.globalColors.red
                : Kb.Styles.globalColors.black,
          },
        ])}
      >
        <Kb.Box2 direction="vertical">
          <Kb.Text type="BodySmall" style={{color: Kb.Styles.globalColors.white}}>
            {this.props.explodesAt === 0 ? 'EXPLODED MESSAGE' : 'EXPLODING MESSAGE'}
          </Kb.Text>
        </Kb.Box2>
        {this.props.explodesAt === 0 ? null : hideTimer ? (
          <Kb.ProgressIndicator white={true} style={{height: 17, width: 17}} />
        ) : (
          <Kb.Box2 direction="horizontal" gap="tiny" gapStart={true} gapEnd={true}>
            <Kb.Icon
              type="iconfont-timer"
              fontSize={Kb.Styles.isMobile ? 20 : 16}
              color={Kb.Styles.globalColors.white}
            />
            <Kb.Text style={{alignSelf: 'center', color: Kb.Styles.globalColors.white}} type="BodySemibold">
              {msToDHMS(this.props.explodesAt - Date.now())}
            </Kb.Text>
          </Kb.Box2>
        )}
      </Kb.Box2>
    )
    return Kb.Styles.isMobile ? (
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.popupContainer}>
        {banner}
        {info}
        <Kb.Divider style={{width: '100%'}} />
      </Kb.Box2>
    ) : (
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.popupContainer}>
        {icon}
        {banner}
        {info}
        <Kb.Divider style={{width: '100%'}} />
      </Kb.Box2>
    )
  }
}

const headerIconType = Kb.Styles.isMobile ? 'icon-fancy-bomb-mobile-226-96' : 'icon-fancy-bomb-desktop-150-72'
const headerIconHeight = Kb.Styles.isMobile ? 48 : 48
const oneMinuteInS = 60

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      headerIcon: {
        height: headerIconHeight,
        marginBottom: Kb.Styles.globalMargins.xtiny,
        marginTop: Kb.Styles.globalMargins.xtiny,
      },
      messageInfoContainer: {
        padding: Kb.Styles.globalMargins.xsmall,
      },
      popupContainer: Kb.Styles.platformStyles({
        common: {alignItems: 'center'},
        isElectron: {
          maxWidth: 240,
          minWidth: 200,
        },
      }),
      revokedAt: {
        borderBottomLeftRadius: 3,
        borderBottomRightRadius: 3,
        width: '100%',
      },
      timerBox: Kb.Styles.platformStyles({
        common: {
          alignItems: 'center',
          justifyContent: 'center',
        },
        isMobile: {height: 46},
      }),
      user: {alignItems: 'center'},
    }) as const
)

export default ExplodingPopupHeader
