// @flow
import * as React from 'react'
import {
  Avatar,
  Box2,
  ConnectedUsernames,
  FloatingMenu,
  HOCTimers,
  Icon,
  ProgressIndicator,
  Text,
  type PropsWithTimer,
  PopupHeaderText,
} from '../../../../../common-adapters/'
import {
  collapseStyles,
  globalColors,
  globalMargins,
  isMobile,
  platformStyles,
  type StylesCrossPlatform,
} from '../../../../../styles'
import {formatTimeForPopup, formatTimeForRevoked, msToDHMS} from '../../../../../util/timestamp'
import {addTicker, removeTicker, type TickerID} from '../../../../../util/second-timer'
import {type MenuItem} from '../../../../../common-adapters/floating-menu/menu-layout'
import type {DeviceType} from '../../../../../constants/types/devices'
import type {Position} from '../../../../../common-adapters/relative-popup-hoc.types'

type Props = {
  attachTo: () => ?React.Component<any>,
  author: string,
  deviceName: string,
  deviceRevokedAt: ?number,
  deviceType: DeviceType,
  explodesAt: number,
  hideTimer: boolean,
  items: Array<MenuItem | 'Divider' | null>,
  onHidden: () => void,
  position: Position,
  style?: StylesCrossPlatform,
  timestamp: number,
  visible: boolean,
  yourMessage: boolean,
}

type State = {
  secondsLeft: number,
}

class ExplodingPopupHeader extends React.Component<PropsWithTimer<Props>, State> {
  timer: TickerID
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
      <Box2 direction="vertical" fullWidth={true} style={{alignItems: 'center'}}>
        <Icon
          style={{marginBottom: globalMargins.small, marginTop: globalMargins.small}}
          type={isMobile ? 'icon-fancy-bomb-mobile-226-96' : 'icon-fancy-bomb-desktop-150-72'}
        />
        <Box2 direction="vertical">
          <Text type="BodySmall" style={{color: globalColors.black_75}}>
            EXPLODING MESSAGE
          </Text>
        </Box2>
        <Box2 direction="horizontal">
          <Text type="BodySmall">by</Text>
          <Box2 direction="horizontal" gap="xtiny" gapStart={true} style={{alignItems: 'center'}}>
            <Avatar username={author} size={16} clickToProfile="tracker" />
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
          <Text type="BodySmall">from device {deviceName}</Text>
        </Box2>
        <Box2 direction="horizontal">
          <Text type="BodySmall">using exploding key</Text>
        </Box2>
        <Box2 direction="horizontal">
          <Text type="BodySmall">{formatTimeForPopup(timestamp)}</Text>
        </Box2>
        {!!deviceRevokedAt && (
          <PopupHeaderText
            color={globalColors.white}
            backgroundColor={globalColors.blue}
            style={styleRevokedAt}
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
          style={collapseStyles([
            styleTimerBox,
            {
              backgroundColor:
                this.state.secondsLeft < oneMinuteInS ? globalColors.red : globalColors.black_75,
            },
          ])}
        >
          {hideTimer ? (
            <ProgressIndicator white={true} style={{height: 17, width: 17}} />
          ) : (
            <Box2 direction="horizontal" gap="tiny" gapStart={true} gapEnd={true}>
              <Icon type="iconfont-timer" fontSize={isMobile ? 22 : 16} color={globalColors.white_40} />
              <Text style={{alignSelf: 'center', color: globalColors.white}} type="BodySemibold">
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

const styleRevokedAt = {
  borderBottomLeftRadius: 3,
  borderBottomRightRadius: 3,
  marginBottom: -globalMargins.small,
  marginTop: globalMargins.small,
  width: '100%',
}

const styleTimerBox = platformStyles({
  common: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: globalMargins.tiny,
  },
  isMobile: {
    height: 46,
  },
})

export default HOCTimers(ExplodingPopupMenu)
