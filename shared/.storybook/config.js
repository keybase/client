// MUST go first
import './preload'
// MUST go first
import {configure} from '@storybook/react'
import load from '../stories'

configure(() => {
  load()
}, module)
