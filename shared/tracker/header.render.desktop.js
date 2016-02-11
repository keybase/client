/* @flow */

import React, {Component} from 'react'
import {Header} from '../common-adapters'
import {Icon, Text} from '../common-adapters/index'
import {globalStyles, globalColors} from '../styles/style-guide'
import flags from '../util/feature-flags'

import type {Styled} from '../styles/common'
import type {HeaderProps} from './header.render'

export default class HeaderRender extends Component {
  props: HeaderProps & Styled;

  render (): ReactElement {
    if (flags.tracker2) {
      return this.render2(styles2)
    }
    return this.renderDefault(styles1)
  }

  renderDefault (styles: any): ReactElement {
    return (
      <Header
        style={{...this.props.style, ...styles.header}}
        icon
        title={this.props.reason}
        onClose={this.props.onClose}
      />
    )
  }

  render2 (styles: any) {
    let warningOnClose = 'You will see this window everytime you access this folder.'
    return (
      <div style={styles.outer}>
        <div style={styles.headerContainer}>
          <Text type='Body' style={{...styles.text, flex: 1}}>{this.props.hoveringOnClose ? warningOnClose : this.props.reason}</Text>
          <Icon type='fa-times' opacity style={styles.close}
            onClick={() => this.props.onClose()}
            onMouseEnter={() => this.closeMouseEnter()}
            onMouseLeave={() => this.closeMouseLeave()} />
        </div>
      </div>
    )
  }

  closeMouseEnter () {
    this.setState({props: this.props, hoveringOnClose: true})
  }

  closeMouseLeave () {
    this.setState({props: this.props, hoveringOnClose: false})
  }
}

HeaderRender.propTypes = {
  reason: React.PropTypes.string,
  onClose: React.PropTypes.func.isRequired,
  style: React.PropTypes.object.isRequired,
  warningOnClose: React.PropTypes.string,
  hoveringOnClose: React.PropTypes.boolean
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
  headerContainer: {
    position: 'absolute',
    top: 0,
    ...globalStyles.flexBoxRow,
    backgroundColor: globalColors.blue,
    height: 90,
    width: 320
  },
  close: {
    position: 'absolute',
    top: 7,
    right: 4
  },
  text: {
    ...globalStyles.flexBoxRow,
    ...globalStyles.line2,
    alignItems: 'center',
    justifyContent: 'center',
    color: globalColors.white,
    maxHeight: 38,
    marginTop: 11,
    marginLeft: 30,
    marginRight: 29,
    marginBottom: 7,
    fontSize: 14,
    textAlign: 'center'
  }
}
