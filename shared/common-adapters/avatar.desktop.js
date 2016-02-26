// @flow

import React, {Component} from 'react'
import resolveRoot from '../../desktop/resolve-root'
import type {Props} from './avatar'

const noAvatar = `file:///${resolveRoot('shared/images/no-avatar@2x.png')}`

export default class Avatar extends Component {
  props: Props;

  render () {
    return (
      <img
        style={{width: this.props.size, height: this.props.size, borderRadius: this.props.size / 2, ...this.props.style}}
        src={this.props.url}
        onError={event => (event.target.src = noAvatar)}/>)
  }
}

Avatar.propTypes = {
  size: React.PropTypes.number.isRequired,
  url: React.PropTypes.string,
  style: React.PropTypes.object
}

