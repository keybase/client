import {configure} from '@storybook/react'
import load from '../stories'

configure(() => {
  load()
}, module)
