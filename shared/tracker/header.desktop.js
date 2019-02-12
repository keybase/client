// @flow
import React, {PureComponent} from 'react'
import {Icon, Text} from '../common-adapters/index'
import {
  globalStyles,
  globalColors,
  globalMargins,
  platformStyles,
  desktopStyles,
  collapseStyles,
} from '../styles'
import {stateColors} from '../util/tracker'
import type {SimpleProofState} from '../constants/types/tracker'

type Props = {
  reason: string,
  onClose: () => void,
  trackerState: SimpleProofState,
  currentlyFollowing: boolean,
  loggedIn: boolean,
  headerStyle?: ?Object,
}

type State = {
  showCloseWarning: boolean,
}

export default class HeaderRender extends PureComponent<Props, State> {
  state: State

  constructor(props: Props) {
    super(props)
    this.state = {showCloseWarning: false}
  }

  render() {
    const isWarningAboutTrackerShowingUpLater =
      this.props.loggedIn && !this.props.currentlyFollowing && this.state.showCloseWarning
    const headerText = isWarningAboutTrackerShowingUpLater
      ? 'You will see this window every time you access this folder.'
      : this.props.reason

    const trackerStateColors = stateColors(this.props.currentlyFollowing, this.props.trackerState)
    const headerBackgroundColor = isWarningAboutTrackerShowingUpLater
      ? globalColors.yellow
      : trackerStateColors.header.background
    const headerTextColor = isWarningAboutTrackerShowingUpLater
      ? globalColors.brown_75
      : trackerStateColors.header.text

    return (
      <div style={styleOuter}>
        <div style={{...styleHeader, backgroundColor: headerBackgroundColor, ...this.props.headerStyle}}>
          <Text
            type="BodySmallSemibold"
            lineClamp={2}
            style={{
              ...styleText,
              backgroundColor: headerBackgroundColor,
              color: headerTextColor,
              ...(isWarningAboutTrackerShowingUpLater ? {zIndex: 2} : {}),
            }}
          >
            {headerText}
          </Text>
          <Icon
            type="iconfont-close"
            style={styleClose}
            onClick={() => this.props.onClose()}
            onMouseEnter={() => this.closeMouseEnter()}
            onMouseLeave={() => this.closeMouseLeave()}
          />
        </div>
      </div>
    )
  }

  closeMouseEnter() {
    this.setState({showCloseWarning: true})
  }

  closeMouseLeave() {
    this.setState({showCloseWarning: false})
  }
}

const styleOuter = {
  position: 'relative',
}

const styleHeader = {
  ...desktopStyles.windowDragging,
  ...globalStyles.flexBoxRow,
  cursor: 'default',
  height: 90,
  position: 'absolute',
  top: 0,
  width: 320,
}

const styleClose = collapseStyles([
  desktopStyles.clickable,
  desktopStyles.windowDraggingClickable,
  {
    position: 'absolute',
    right: 9,
    top: 7,
    zIndex: 2,
  },
])

const styleText = platformStyles({
  common: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
    color: globalColors.white,
    flex: 1,
    justifyContent: 'center',
    marginBottom: 40,
    paddingLeft: globalMargins.medium,
    paddingRight: globalMargins.medium,
    textAlign: 'center',
  },
  isElectron: {
    lineHeight: 'normal',
  },
})
