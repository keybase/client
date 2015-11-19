'use strict'

import React, { Component } from '../base-react'
import { TextField, RaisedButton, Checkbox } from 'material-ui'

export default class PinentryRender extends Component {
  componentWillMount () {
    this.state = {
      passphrase: '',
      features: {}
    }
    for (const feature in this.props.payload.features) {
      console.log(feature)
      if (this.props.payload.features[feature].hasOwnProperty('allow')) {
        console.log(this.props.payload.features[feature].allow)
        this.state.features[feature] = this.props.payload.features[feature].allow
      } else {
        console.error('We were passed a payload with no allow field!')
      }
    }
    console.log(this.state)
  }

  render () {
    return (
      <div>
        <p>{this.props.payload.promptText}</p>
        <TextField
          ref='passphrase'
          onChange={e => this.setState({passphrase: e.target.value})}
          floatingLabelText='Your passphrase'
          value={this.state.passphrase} />

        {Object.keys(this.props.payload.features).map((feature) => {
          return <Checkbox
            key={feature}
            name={feature}
            value={feature}
            label={this.props.payload.features[feature].label}
            defaultChecked={this.props.payload.features[feature].allow}
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
  payload: React.PropTypes.object.isRequired
}
