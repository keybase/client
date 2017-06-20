/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
// @flow
import {configure} from '@storybook/react'

// Load css
import '../desktop/renderer/style.css'

// $FlowIssue
const req = require.context('../common-adapters', true, /\.stories\.js$/)

configure(() => {
  req.keys().forEach(filename => req(filename))
}, module)
