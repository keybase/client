/* @flow */

import React, {Component} from 'react'
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
      <Box style={{...styles.container, ...this.props.style}} onClick={e => this.onClick(e)}>
        <Icon type='fa-arrow-left' style={styles.icon}/>
        <Text type='BodyPrimaryLink' onClick={e => this.onClick(e)}>Back</Text>
      </Box>
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
    marginRight: 8
  }
}
