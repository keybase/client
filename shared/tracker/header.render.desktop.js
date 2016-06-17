/* @flow */

import React, {Component} from 'react'
import {Icon, Text} from '../common-adapters/index'
import {globalStyles, globalColors} from '../styles/style-guide'

import type {HeaderProps} from './header.render'

export default class HeaderRender extends Component {
  props: HeaderProps;
  state: {showCloseWarning: boolean};

  constructor (props: HeaderProps) {
    super(props)
    this.state = {showCloseWarning: false}
  }

  render () {
    let headerStyle = this.props.currentlyFollowing ? styleHeaderFollowing : styleHeaderNotFollowing
    let headerTextStyle = styleHeaderTextNormal

    if (this.props.currentlyFollowing) {
      switch (this.props.trackerState) {
        case 'warning':
          headerStyle = styleHeaderWarning
          headerTextStyle = styleHeaderTextWarning
          break
        case 'error': headerStyle = styleHeaderError; break
      }
    }

    let headerText: string = this.props.reason
    let isWarning = false
    if (this.props.loggedIn && !this.props.currentlyFollowing && this.state.showCloseWarning) {
      isWarning = true
      headerStyle = styleHeaderWarning
      headerTextStyle = styleHeaderTextWarning
      headerText = 'You will see this window every time you access this folder.'
    }

    // If there's a lastAction, it overrides everything else.
    switch (this.props.lastAction) {
      case 'followed':
      case 'refollowed':
        headerStyle = styleHeaderFollowing
        headerTextStyle = styleHeaderTextNormal
        headerText = this.props.reason
        break
      case 'unfollowed':
        headerStyle = styleHeaderNotFollowing
        headerTextStyle = styleHeaderTextNormal
        headerText = this.props.reason
        break
      case 'error':
        headerStyle = styleHeaderWarning
        headerTextStyle = styleHeaderTextWarning
    }

    return (
      <div style={styleOuter}>
        <div style={{...styleHeader, ...headerStyle}}>
          <div style={{...styleHeader, ...headerStyle, height: 48, zIndex: 2, opacity: isWarning ? 1 : 0, backgroundColor: globalColors.yellow}} />
          <Text type='BodySemibold' lineClamp={2} style={{...styleText, ...headerTextStyle, flex: 1, zIndex: isWarning ? 2 : 'inherit'}}>{headerText}</Text>
          <Icon type='fa-close' style={styleClose}
            onClick={() => this.props.onClose()}
            onMouseEnter={() => this.closeMouseEnter()}
            onMouseLeave={() => this.closeMouseLeave()} />
        </div>
      </div>
    )
  }

  closeMouseEnter () {
    this.setState({showCloseWarning: true})
  }

  closeMouseLeave () {
    this.setState({showCloseWarning: false})
  }
}

const styleOuter = {
  position: 'relative',
}

const styleHeader = {
  ...globalStyles.windowDragging,
  cursor: 'default',
  position: 'absolute',
  top: 0,
  ...globalStyles.flexBoxRow,
  height: 90,
  width: 320,
}

const styleHeaderNotFollowing = {
  backgroundColor: globalColors.blue,
}

const styleHeaderFollowing = {
  backgroundColor: globalColors.green,
}

const styleHeaderWarning = {
  backgroundColor: globalColors.yellow,
}

const styleHeaderTextNormal = {
  color: globalColors.white,
  fontSize: 14,
  lineHeight: 'normal',
  opacity: 1,
}

const styleHeaderTextWarning = {
  color: globalColors.brown_60,
  fontSize: 14,
  lineHeight: 'normal',
  opacity: 1,
}

const styleHeaderError = {
  backgroundColor: globalColors.red,
}

const styleClose = {
  ...globalStyles.clickable,
  ...globalStyles.windowDraggingClickable,
  zIndex: 2,
  position: 'absolute',
  top: 7,
  right: 9,
}

const styleText = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  justifyContent: 'center',
  color: globalColors.white,
  marginLeft: 30,
  marginRight: 30,
  marginBottom: 32,
  fontSize: 14,
  textAlign: 'center',
}
