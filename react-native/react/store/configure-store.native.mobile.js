'use strict'

import { createStore } from 'redux'

export default f => f(createStore)
