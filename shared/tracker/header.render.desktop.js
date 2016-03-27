/* @flow */

import React, {Component} from 'react'
import {Icon, Text} from '../common-adapters/index'
import {globalStyles, globalColors} from '../styles/style-guide'

import type {HeaderProps} from './header.render'

export default class HeaderRender extends Component {
  props: HeaderProps;

  render () {
    // $FlowFixMe // how we split these props needs to change
    let headerStyle = this.props.backgroundStyle
    let headerTextStyle = styles.headerTextNormal

    if (this.props.currentlyFollowing) {
      switch (this.props.trackerState) {
        case 'warning':
          headerTextStyle = styles.headerTextWarning
          break
      }
    }

    let headerText: string = this.props.reason
    if (!this.props.currentlyFollowing && this.props.showCloseWarning) {
      headerTextStyle = styles.headerTextWarning
      headerText = 'You will see this window every time you access this folder.'
    }

    // If there's a lastAction, it overrides everything else.
    switch (this.props.lastAction) {
      case 'followed':
      case 'refollowed':
      case 'unfollowed':
        headerTextStyle = styles.headerTextNormal
        headerText = this.props.reason
        break
      case 'error':
        headerTextStyle = styles.headerTextWarning
    }

    return (
      <div style={{...styles.header, ...headerStyle}}>
        <Text type='BodySemibold' style={{...styles.text, ...headerTextStyle}}>{headerText}</Text>
        <Icon type='fa-close' style={styles.close}
          onClick={() => this.props.onClose()}
          onMouseEnter={() => this.closeMouseEnter()}
          onMouseLeave={() => this.closeMouseLeave()} />
      </div>
    )
  }

  closeMouseEnter () {
    // $FlowFixMe // how we split these props needs to change
    this.props.onShowCloseWarning(true)
  }

  closeMouseLeave () {
    // $FlowFixMe // how we split these props needs to change
    this.props.onShowCloseWarning(false)
  }
}

const styles = {
  header: {
    ...globalStyles.windowDragging,
    cursor: 'default'
  },
  headerTextNormal: {
    color: globalColors.white,
    fontSize: 14,
    lineHeight: 'normal'
  },
  headerTextWarning: {
    color: globalColors.brown60,
    fontSize: 14,
    lineHeight: 'normal'
  },
  close: {
    ...globalStyles.clickable,
    ...globalStyles.windowDraggingClickable,
    position: 'absolute',
    top: 7,
    right: 9
  },
  text: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
    justifyContent: 'center',
    color: globalColors.white,
    fontSize: 14,
    textAlign: 'center',
    padding: '10px 30px',
    minHeight: 54
  }
}
