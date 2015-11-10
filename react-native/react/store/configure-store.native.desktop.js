'use strict'
/* @flow */

import { createStore, compose } from 'redux'
import { devTools } from 'redux-devtools'

export default f => compose(f, devTools())(createStore)
