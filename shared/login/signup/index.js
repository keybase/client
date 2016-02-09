/* @flow */

import React from 'react'
import Form from '../form'
import ErrorText from '../error.render'

// Signup Components
import InviteCode from './inviteCode'
import UsernameEmailForm from './usernameEmailForm'
import PassphraseSignup from './passphrase'
import DeviceName from './deviceName'

import {Map} from 'Immutable'
import type {URI} from '../../reducers/router'

export default function SignupRouter (currentPath: Map<string, string>, uri: URI): any {
  // Fallback (for debugging)
  let form = <ErrorText currentPath={currentPath} />

  const path = currentPath.get('path')

  const {component: Component, props} = currentPath.get('parseRoute') || {}
  if (Component) {
    form = <Component {...props}/>
  } else {
    switch (path) {
      case 'signup':
      case 'inviteCode':
        form = <InviteCode/>
        break
      case 'usernameAndEmail':
        form = <UsernameEmailForm/>
        break
      case 'passphraseSignup':
        form = <PassphraseSignup/>
        break
      case 'deviceName':
        form = <DeviceName/>
        break
    }
  }

  return {
    componentAtTop: {
      component: Form,
      hideBack: true,
      props: {
        formComponent: () => form
      }
    },
    parseNextRoute: SignupRouter
  }
}
