import React, {Component} from 'react'
import resolveRoot from '../../../desktop/resolve-root'

export default class Logo extends Component {
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
