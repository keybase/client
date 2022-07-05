// MUST go first
import './preload'
import {enableAllPlugins} from 'immer'
// MUST go first
import {configure} from '@storybook/react'
enableAllPlugins()

configure(() => {
  const load = require('../stories/index.native').default
  load()
}, module)
