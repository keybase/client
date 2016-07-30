// @flow
import DeviceName from './device-name'
import ErrorText from '../error.render'
import InviteCode from './invite-code'
import PassphraseSignup from './passphrase'
import React from 'react'
import RequestInvite from './request-invite'
import RequestInviteSuccess from './request-invite-success'
import SignupError from './error'
import Success from './success'
import UsernameEmailForm from './username-email-form'
import type {URI} from '../../constants/router'
import {Map} from 'immutable'

function signupRouter (currentPath: Map<string, string>, uri: URI): any {
  // Fallback (for debugging)
  let element = <ErrorText currentPath={currentPath} />

  const path = currentPath.get('path')
  const parseRoute: any = currentPath.get('parseRoute')

  const {component: Component, props} = parseRoute || {}
  if (Component) {
    element = <Component {...props} />
  } else {
    switch (path) {
      case 'signup':
      case 'inviteCode':
        element = <InviteCode />
        break
      case 'requestInvite':
        element = <RequestInvite />
        break
      case 'requestInviteSuccess':
        element = <RequestInviteSuccess />
        break
      case 'usernameAndEmail':
        element = <UsernameEmailForm />
        break
      case 'passphraseSignup':
        element = <PassphraseSignup />
        break
      case 'deviceName':
        element = <DeviceName />
        break
      case 'paperkey':
      case 'success':
        element = <Success />
        break
      case 'signupError':
        element = <SignupError />
        break
    }
  }

  return {
    componentAtTop: {
      element,
      hideBack: true,
      hideNavBar: true,
    },
    parseNextRoute: signupRouter,
  }
}

export default signupRouter
