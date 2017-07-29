import {configure} from '@storybook/react'
import load from '../stories'
import 'babel-polyfill'

configure(() => {
  load()
}, module)
