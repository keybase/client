'use strict'

import React, { Component } from '../base-react'
import PinentryRender from './pinentry-render'

export default class Pinentry extends Component {
  render () {
    return <PinentryRender {...this.props} />
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        title: 'pinentry',
        props: {
          onSubmit: passphrase => console.log(`Passphrase submitted: ${passphrase}`),
          onCancel: () => console.log('Pinentry canceled'),
          // Temp until implemented.
          user: 'someusers'
        }
      }
    }
  }
}

Pinentry.propTypes = PinentryRender.propTypes
