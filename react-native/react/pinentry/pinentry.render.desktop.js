import React, { Component } from '../base-react'
import { TextField, RaisedButton, Checkbox } from 'material-ui'

export default class PinentryRender extends Component {
  componentWillMount () {
    this.state = {
      passphrase: '',
      features: {}
    }
    for (const feature in this.props.features) {
      this.state.features[feature] = this.props.features[feature].allow
    }
  }

  render () {
    return (
      <div>
        <p>{this.props.prompt}</p>
        <TextField
          ref='passphrase'
          onChange={e => this.setState({passphrase: e.target.value})}
          floatingLabelText='Your passphrase'
          value={this.state.passphrase} />

        {Object.keys(this.props.features).map((feature) => {
          return <Checkbox
            key={feature}
            name={feature}
            value={feature}
            label={this.props.features[feature].label}
            defaultChecked={this.props.features[feature].allow}
            style={{marginTop: 30}}
            onCheck={(_, checked) => { this.state.features[feature] = checked }}
          />
        })}

        <RaisedButton style={{margin: 5}} onClick={() => this.props.onCancel()} label='Cancel' />

        <RaisedButton style={{margin: 5}} onClick={() => this.props.onSubmit(this.state.passphrase, this.state.features)} label='OK' />
      </div>
    )
  }
}

PinentryRender.propTypes = {
  onSubmit: React.PropTypes.func.isRequired,
  onCancel: React.PropTypes.func.isRequired,
  features: React.PropTypes.object.isRequired,
  prompt: React.PropTypes.string.isRequired,
  retryLabel: React.PropTypes.string.isRequired,
  windowTitle: React.PropTypes.string.isRequired
}
