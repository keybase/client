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
    let headerStyle = (this.props.currentlyFollowing && !this.props.changed) ? styles.headerSuccess : styles.headerNormal
    let headerTextStyle = styles.headerTextNormal

    if (this.props.currentlyFollowing) {
      switch (this.props.trackerState) {
        case 'warning':
          headerStyle = styles.headerWarning
          headerTextStyle = styles.headerTextWarning
          break
        case 'error': headerStyle = styles.headerError; break
      }
    }

    let headerText: string = this.props.reason
    let isWarning = false
    if (!this.props.currentlyFollowing && this.state.showCloseWarning) {
      isWarning = true
      headerStyle = styles.headerWarning
      headerTextStyle = styles.headerTextWarning
      headerText = 'You will see this window every time you access this folder.'
    }

    // If there's a lastAction, it overrides everything else.
    switch (this.props.lastAction) {
      case 'followed':
      case 'refollowed':
      case 'unfollowed':
        headerStyle = styles.headerSuccess
        headerTextStyle = styles.headerTextNormal
        headerText = this.props.reason
        break
      case 'error':
        headerStyle = styles.headerWarning
        headerTextStyle = styles.headerTextWarning
    }

    return (
      <div style={styles.outer}>
        <div style={{...styles.header, ...headerStyle}}>
          <div style={{...styles.header, ...headerStyle, height: 48, zIndex: 2, opacity: isWarning ? 1 : 0, backgroundColor: globalColors.yellow}}/>
          <Text type='BodySemibold' lineClamp={2} style={{...styles.text, ...headerTextStyle, flex: 1, zIndex: isWarning ? 2 : 'inherit'}}>{headerText}</Text>
          <Icon type='fa-close' style={styles.close}
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

const styles = {
  outer: {
    position: 'relative'
  },
  header: {
    ...globalStyles.windowDragging,
    cursor: 'default',
    position: 'absolute',
    top: 0,
    ...globalStyles.flexBoxRow,
    height: 90,
    width: 320
  },
  headerNormal: {
    backgroundColor: globalColors.blue
  },
  headerSuccess: {
    backgroundColor: globalColors.green
  },
  headerWarning: {
    backgroundColor: globalColors.yellow
  },
  headerTextNormal: {
    color: globalColors.white,
    fontSize: 14,
    lineHeight: 'normal',
    opacity: 1
  },
  headerTextWarning: {
    color: globalColors.brown60,
    fontSize: 14,
    lineHeight: 'normal',
    opacity: 1
  },
  headerError: {
    backgroundColor: globalColors.red
  },
  close: {
    ...globalStyles.clickable,
    ...globalStyles.windowDraggingClickable,
    zIndex: 2,
    position: 'absolute',
    top: 7,
    right: 9
  },
  text: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
    justifyContent: 'center',
    color: globalColors.white,
    marginLeft: 30,
    marginRight: 30,
    marginBottom: 32,
    fontSize: 14,
    textAlign: 'center'
  }
}
