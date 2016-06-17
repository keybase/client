/* @flow */

import React from 'react'
import Intro from './forms/intro'
import ErrorText from './error.render'

import signupRouter from './signup'
import Login from './login'

import {Map} from 'immutable'
import type {URI} from '../reducers/router'

function loginRouter (currentPath: Map<string, string>, uri: URI): any {
  // Fallback (for debugging)
  let element = <ErrorText currentPath={currentPath} />

  const path = currentPath.get('path')
  const parseRoute: any = currentPath.get('parseRoute')
  let {componentAtTop: {component: Component, props, element: dynamicElement}} = parseRoute || {componentAtTop: {}}

  if (dynamicElement) {
    element = dynamicElement
  } else if (Component) {
    element = <Component {...props} />
  } else {
    switch (path) {
      case 'root':
        element = <Intro />
        break
      case 'signup':
        return signupRouter(currentPath, uri)
      case 'login':
        element = <Login />
        break
    }
  }

  return {
    componentAtTop: {
      element,
      hideBack: true,
      hideNavBar: true,
    },
    parseNextRoute: loginRouter,
  }
}

export default {
  parseRoute: loginRouter,
}
