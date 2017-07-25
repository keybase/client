/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
// @flow
import React from 'react'
import ScrollView from '../common-adapters/scroll-view'
import {configure, addDecorator} from '@storybook/react'

// Load css
import '../desktop/renderer/style.css'

const load = () => {
  // Load all stories
  // $FlowIssue
  const req = require.context('..', true, /\.stories\.js$/)

  addDecorator(story => (
    <ScrollView key="scrollview" style={{flex: 1}}>
      {story()}
    </ScrollView>
  ))

  configure(() => {
    req.keys().forEach(filename => {
      req(filename).default()
    })
  }, module)
}

export default load
