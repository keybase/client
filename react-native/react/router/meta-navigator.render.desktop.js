import React, {Component} from '../base-react'

export default class MetaNavigatorRender extends Component {
  render () {
    const {rootComponent, uri, getComponentAtTop} = this.props
    const {componentAtTop} = getComponentAtTop(rootComponent, uri)
    const Module = componentAtTop.component

    return (
      <Module {...componentAtTop.props} />
    )
  }
}

MetaNavigatorRender.propTypes = {
  uri: React.PropTypes.object.isRequired,
  getComponentAtTop: React.PropTypes.func.isRequired,
  rootComponent: React.PropTypes.func.isRequired
}
