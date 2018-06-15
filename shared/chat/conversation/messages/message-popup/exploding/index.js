// @flow
import * as React from 'react'
import {
  Avatar,
  Box2,
  FloatingMenu,
  Icon,
  Text,
  HOCTimers,
  type PropsWithTimer,
} from '../../../../../common-adapters/'
import {collapseStyles, globalColors, globalMargins, isMobile, platformStyles} from '../../../../../styles'
import {formatTimeForPopup, formatTimeForRevoked, msToDHMS} from '../../../../../util/timestamp'
import {addTicker, removeTicker, type TickerID} from '../../../../../util/second-timer'
import {PopupHeaderText, type MenuItem} from '../../../../../common-adapters/popup-menu'
import type {DeviceType} from '../../../../../constants/types/devices'
import type {Position} from '../../../../../common-adapters/relative-popup-hoc'

type Props = {
  attachTo: ?React.Component<any, any>,
  author: string,
  deviceName: string,
  deviceRevokedAt: ?number,
  deviceType: DeviceType,
  explodesAt: number,
  items: Array<MenuItem | 'Divider' | null>,
  onHidden: () => void,
  position: Position,
  style?: Object,
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
    secondsLeft: 0,
  }

  componentWillMount() {
    if (!__STORYBOOK__) {
      this.timer = addTicker(this.tick)
    }
    this.tick()
  }

  componentWillUnmount() {
    this.timer && removeTicker(this.timer)
  }

  tick = () => {
    const now = __STORYBOOK__ ? 1999999999000 : Date.now()
    let secondsLeft = Math.floor((this.props.explodesAt - now) / 1000)
    if (secondsLeft < 0) {
      // TODO remove if we end up w/ an "exploded" popup
      this.props.onHidden()
      secondsLeft = 0
    }
    this.setState({secondsLeft})
  }

  render() {
    const {author, deviceName, deviceRevokedAt, timestamp, yourMessage} = this.props
    const whoRevoked = yourMessage ? 'You' : author
    const bombVerticalOffset = isMobile ? 0 : -20
    return (
      <Box2
        direction="vertical"
        fullWidth={true}
        style={{alignItems: 'center', paddingTop: (isMobile ? 96 : 64) + bombVerticalOffset}}
      >
        <Icon
          style={{marginBottom: globalMargins.tiny, position: 'absolute', top: bombVerticalOffset}}
          type={isMobile ? 'icon-fancy-bomb-129-96' : 'icon-fancy-bomb-86-64'}
        />
        <Box2 direction="horizontal">
          <Text type="BodySmall" style={{color: globalColors.black}}>
            EXPLODING MESSAGE
          </Text>
        </Box2>
        <Box2 direction="horizontal">
          <Text type="BodySmall" style={{color: globalColors.black_40}}>
            by
          </Text>
          <Box2 direction="horizontal" gap="xtiny" gapStart={true} style={{alignItems: 'center'}}>
            <Avatar username={author} size={16} />
            <Text type="BodySmallSemibold" style={{color: globalColors.black_60}}>
              {author}
            </Text>
          </Box2>
        </Box2>
        <Box2 direction="horizontal">
          <Text type="BodySmall" style={{color: globalColors.black_40}}>
            using device&nbsp;{deviceName}
          </Text>
        </Box2>
        <Box2 direction="horizontal">
          <Text type="BodySmall" style={{color: globalColors.black_40}}>
            {formatTimeForPopup(timestamp)}
          </Text>
        </Box2>
        {deviceRevokedAt && (
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
          style={{
            backgroundColor: this.state.secondsLeft < oneMinuteInS ? globalColors.red : globalColors.black_75,
            marginTop: globalMargins.tiny,
          }}
        >
          <Text style={{color: globalColors.white, textAlign: 'center'}} type="BodySemibold">
            {msToDHMS(this.props.explodesAt - Date.now())}
          </Text>
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
      style={collapseStyles([stylePopup, props.style])}
      visible={props.visible}
    />
  )
}

const oneMinuteInS = 60

const stylePopup = platformStyles({
  common: {
    overflow: 'visible',
  },
  isElectron: {
    width: 196,
  },
  isMobile: {
    width: '100%',
  },
})

const styleRevokedAt = {
  borderBottomLeftRadius: 3,
  borderBottomRightRadius: 3,
  marginBottom: -globalMargins.small,
  marginTop: globalMargins.small,
  width: '100%',
}

export default HOCTimers(ExplodingPopupMenu)
