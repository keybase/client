/* @flow */

import {ipcRenderer} from 'electron'
import React, {Component} from 'react'
import ReactDOM from 'react-dom'
import {styleBox} from '../more/dumb-sheet.render.desktop'
import {Box, Text} from '../common-adapters'
import dumbComponentMap from '../more/dumb-component-map'

const PADDING = 25

ipcRenderer.on('display', (ev, msg) => {
  const map = dumbComponentMap[msg.key]
  const Component = map.component
  const mockKey = msg.mockKey
  const mock = map.mocks[mockKey]
  const parentProps = mock.parentProps
  mock.parentProps = undefined

  const displayTree = (
    <Box key={mockKey} id='rendered' style={{alignSelf: 'flex-start', ...styleBox, margin: PADDING}}>
      <Text type='Body' style={{marginBottom: 5}}>{mockKey}</Text>
      <Box {...parentProps}>
        <Component key={mockKey} {...mock} />
      </Box>
    </Box>
  )

  const appEl = document.getElementById('app')
  ReactDOM.render(displayTree, appEl, () => {
    // Unfortunately some resources like fonts lazy load after they're
    // rendered.  We need to give the renderer time to load.  After trying
    // process.nextTick, requestAnimationFrame, etc., simply putting in a time
    // delay worked the best.
    setTimeout(() => {
      const renderedEl = document.getElementById('rendered')
      const box = renderedEl.getBoundingClientRect()
      const rect = {
        x: box.left - PADDING,
        y: box.top - PADDING,
        width: Math.floor(box.width) + 2 * PADDING,
        height: Math.floor(box.height + 2 * PADDING)
      }

      ev.sender.send('display-done', {rect, ...msg})
    }, 250)
  })
})
