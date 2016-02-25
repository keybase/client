/* @flow */

import React, {Component} from 'react'
import {Header} from '../common-adapters'
import {Icon, Text} from '../common-adapters/index'
import {globalStyles, globalColorsDZ2} from '../styles/style-guide'
import flags from '../util/feature-flags'

import type {HeaderProps} from './header.render'

export default class HeaderRender extends Component {
  props: HeaderProps;
  state: {showCloseWarning: boolean};

  constructor (props: HeaderProps) {
    super(props)
    this.state = {showCloseWarning: false}
  }

  render () {
    if (flags.tracker2) {
      return this.render2(styles2)
    }
    return this.renderDefault(styles1)
  }

  renderDefault (styles: Object) {
    return (
      <Header
        style={styles.header}
        icon
        title={this.props.reason}
        onClose={this.props.onClose}
      />
    )
  }

  render2 (styles: Object) {
    let headerStyle = (this.props.currentlyFollowing && !this.props.changed) ? styles.headerSuccess : styles.headerNormal
    let headerTextStyle = styles.headerTextNormal
    switch (this.props.trackerState) {
      case 'warning':
        headerStyle = styles.headerWarning
        headerTextStyle = styles.headerTextWarning
        break
      case 'error': headerStyle = styles.headerError; break
    }

    let headerText:string = this.props.reason
    if (!this.props.currentlyFollowing && this.state.showCloseWarning) {
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
        break
      case 'error':
        headerStyle = styles.headerWarning
        headerTextStyle = styles.headerTextWarning
    }

    return (
      <div style={styles.outer}>
        <div style={{...styles.header, ...headerStyle}}>
          <Text type='BodySemibold' dz2 lineClamp={2} style={{...styles.text, ...headerTextStyle, flex: 1}}>{headerText}</Text>
          <Icon type='fa-times' opacity style={styles.close}
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

const styles1 = {
  header: {
    paddingLeft: 15
  }
}

const styles2 = {
  outer: {
    position: 'relative'
  },
  header: {
    position: 'absolute',
    top: 0,
    ...globalStyles.flexBoxRow,
    height: 90,
    width: 320
  },
  headerNormal: {
    backgroundColor: globalColorsDZ2.blue
  },
  headerSuccess: {
    backgroundColor: globalColorsDZ2.green
  },
  headerWarning: {
    backgroundColor: globalColorsDZ2.yellow
  },
  headerTextNormal: {
    color: globalColorsDZ2.white,
    fontSize: 14,
    lineHeight: 'normal',
    opacity: 1
  },
  headerTextWarning: {
    color: globalColorsDZ2.black,
    fontSize: 14,
    lineHeight: 'normal',
    opacity: 1
  },
  headerError: {
    backgroundColor: globalColorsDZ2.red
  },
  close: {
    position: 'absolute',
    top: 7,
    right: 4
  },
  text: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
    justifyContent: 'center',
    color: globalColorsDZ2.white,
    marginLeft: 15,
    marginRight: 15,
    marginBottom: 32,
    fontSize: 14,
    textAlign: 'center'
  }
}
