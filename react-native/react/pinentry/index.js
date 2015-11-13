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
          onSubmit: (passphrase, features) => {
            console.log(`Passphrase submitted: ${passphrase}`)
            console.log(features)
          },
          onCancel: () => console.log('Pinentry dialog canceled'),
          // Mock out the RPC payload until implemented.
          payload: {
            windowTitle: 'Keybase',
            promptText: 'Please enter the Keybase passphrase for cjb (12+ characters)',
            features: {
              secretStorage: {
                value: true,
                label: 'Store my passphrase for later use'
              },
              secondFeature: {
                value: false,
                label: 'Test a second checkbox'
              }
            }
          }
        }
      }
    }
  }
}

Pinentry.propTypes = PinentryRender.propTypes
