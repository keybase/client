/* @flow */

import React, {Component} from 'react'
import {Text, Icon} from './index'
import {globalStyles} from '../styles/style-guide'
import type {Props} from './back-button'

export default class BackButton extends Component {
  props: Props;

  render () {
    return (
      <div style={{...styles.container, ...this.props.style}} onClick={this.props.onClick}>
        <Icon type='fa-arrow-left' style={styles.icon}/>
        <Text type='BodyPrimaryLink' onClick={() => this.props.onClick()}>Back</Text>
      </div>
    )
  }
}

BackButton.propTypes = {
  onClick: React.PropTypes.func.isRequired,
  style: React.PropTypes.object
}

export const styles = {
  container: {
    ...globalStyles.flexBoxRow,
    ...globalStyles.clickable,
    alignItems: 'center'
  },
  icon: {
    fontSize: 12,
    marginRight: 8
  }
}

