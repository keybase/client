/* @flow */

import React, {Component} from 'react'
import Intro from './forms/intro'
import ErrorText from './error.render'

import signupRouter from './signup'

// Register Components
import Register from './register'

import {Map} from 'immutable'
import type {URI} from '../reducers/router'

function loginRouter (currentPath: Map<string, string>, uri: URI): any {
  // Fallback (for debugging)
  let form = <ErrorText currentPath={currentPath} />

  const path = currentPath.get('path')

  const {componentAtTop: {component: Component, props}} = currentPath.get('parseRoute') || {componentAtTop: {}}
  if (Component) {
    form = <Component {...props}/>
  } else {
    switch (path) {
      case 'root':
        form = <Intro/>
        break
      case 'signup':
        return signupRouter(currentPath, uri)
      case 'register':
        form = <Register />
        break
    }
  }

  return {
    componentAtTop: {
      component: () => form,
      hideBack: true
    },
    parseNextRoute: loginRouter
  }
}

export default {
  parseRoute: loginRouter
}
