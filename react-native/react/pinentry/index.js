'use strict'
/* @flow */

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
          // Mock out the RPC payload until implemented.
          payload: {
            window_title: 'Keybase',
            prompt_text: 'Please enter the Keybase passphrase for cjb (12+ characters)',
            features: {
              secret_storage: {
                value: true,
                label: 'Store my passphrase for later use'
              }
            }
          }
        }
      }
    }
  }
}

Pinentry.propTypes = PinentryRender.propTypes
