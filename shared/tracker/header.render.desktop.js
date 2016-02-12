/* @flow */

import React, {Component} from 'react'
import {Header} from '../common-adapters'
import {Icon, Text} from '../common-adapters/index'
import {globalStyles, globalColors} from '../styles/style-guide'
import flags from '../util/feature-flags'

import type {HeaderProps} from './header.render'

export default class HeaderRender extends Component {
  props: HeaderProps;
  state: {showCloseWarning: boolean};

  constructor (props: HeaderProps) {
    super(props)
    this.state = {showCloseWarning: false}
  }

  render (): ReactElement {
    if (flags.tracker2) {
      return this.render2(styles2)
    }
    return this.renderDefault(styles1)
  }

  renderDefault (styles: Object): ReactElement {
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
    let headerStyle:Object = (this.props.currentlyFollowing ? styles.headerSuccess : styles.headerNormal)
    switch (this.props.trackerState) {
      case 'warning': headerStyle = styles.headerWarning; break
      case 'error': headerStyle = styles.headerError; break
    }

    let headerText:string = this.props.reason
    if (!this.props.currentlyFollowing && this.state.showCloseWarning) {
      headerStyle = styles.headerWarning
      headerText = 'You will see this window everytime you access this folder.'
    }

    return (
      <div style={styles.outer}>
        <div style={{...styles.header, ...headerStyle}}>
          <Text type='Body' lineClamp={2} style={{...styles.text, flex: 1}}>{headerText}</Text>
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
    backgroundColor: globalColors.blue
  },
  headerSuccess: {
    backgroundColor: globalColors.green
  },
  headerWarning: {
    backgroundColor: globalColors.lowRiskWarning
  },
  headerError: {
    backgroundColor: globalColors.red
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
    color: globalColors.white,
    marginLeft: 15,
    marginRight: 15,
    marginBottom: 32,
    fontSize: 14,
    textAlign: 'center'
  }
}
