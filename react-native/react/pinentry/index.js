'use strict'
/* @flow */

import React from 'react'
import BaseComponent from '../base-component'
import PinentryRender from './pinentry-render'

export default class Pinentry extends BaseComponent {
  render () {
    return <PinentryRender {...this.props} />
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        title: 'pinentry',
        props: {
          onSubmit: passphrase => store.dispatch(submitPassphrase(passphrase)),
          onCancel: name => store.dispatch(cancel()),
        }
      }
    }
  }
}
