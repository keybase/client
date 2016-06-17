/* @flow */

import React, {Component} from 'react'
import {TouchableWithoutFeedback} from 'react-native'
import {Box} from '../common-adapters'
import {Text, Icon} from './index'
import {globalStyles} from '../styles/style-guide'
import type {Props} from './back-button'

export default class BackButton extends Component {
  props: Props;

  onClick (event: SyntheticEvent) {
    event && event.preventDefault && event.preventDefault()
    event && event.stopPropagation && event.stopPropagation()
    if (this.props.onClick) {
      this.props.onClick()
    }
  }

  render () {
    return (
      <TouchableWithoutFeedback onPress={e => this.onClick(e)}>
        <Box style={{...styles.container, ...this.props.style}} >
          <Icon type='fa-arrow-left' style={{...styles.icon, ...this.props.iconStyle}} />
          {this.props.title !== null && <Text type='BodyPrimaryLink' style={this.props.textStyle} onClick={e => this.onClick(e)}>{this.props.title || 'Back'}</Text>}
        </Box>
      </TouchableWithoutFeedback>
    )
  }
}

BackButton.propTypes = {
  onClick: React.PropTypes.func.isRequired,
  style: React.PropTypes.object,
}

export const styles = {
  container: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
  },
  icon: {
    marginRight: 8,
  },
}
