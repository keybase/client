import React, {Component} from '../base-react'
import resolveAssets from '../../../desktop/resolve-assets'

export default class Logo extends Component {
  render () {
    const style = {
      width: this.props.small ? 42 : 124,
      ...(this.props.grey ? {WebkitFilter: 'grayscale()'} : {})
    }
    return (
      <img style={style} src={`file://${resolveAssets('../react-native/react/images/service/keybase.png')}`}/>
    )
  }
}

Logo.propTypes = {
  small: React.PropTypes.bool,
  grey: React.PropTypes.bool
}
