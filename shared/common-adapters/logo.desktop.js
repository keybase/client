/* @flow */
import React, {Component} from 'react'
import resolveRoot from '../../desktop/resolve-root'

import type {Props} from './logo'

export default class Logo extends Component {
  props: Props;
  render () {
    const style = {
      width: this.props.small ? 42 : 124,
      ...(this.props.grey ? {WebkitFilter: 'grayscale()'} : {})
    }
    return (
      <img style={style} src={`file://${resolveRoot('shared/images/service/keybase.png')}`}/>
    )
  }
}

Logo.propTypes = {
  small: React.PropTypes.bool,
  grey: React.PropTypes.bool
}
