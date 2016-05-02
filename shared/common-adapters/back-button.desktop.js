/* @flow */

import React, {Component} from 'react'
import {Text, Icon} from './index'
import {globalStyles} from '../styles/style-guide'
import type {Props} from './back-button'

export default class BackButton extends Component {
  props: Props;

  onClick (event: SyntheticEvent) {
    event.preventDefault()
    event.stopPropagation()
    if (this.props.onClick) {
      this.props.onClick()
    }
  }

  render () {
    return (
      <div style={{...styles.container, ...this.props.style}} onClick={e => this.onClick(e)}>
        <Icon type='fa-arrow-left' style={styles.icon} />
        <Text type='BodyPrimaryLink' onClick={e => this.onClick(e)}>Back</Text>
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

