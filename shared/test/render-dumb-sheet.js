/* @flow */

import {ipcRenderer} from 'electron'
import React from 'react'
import ReactDOM from 'react-dom'
import {MuiThemeProvider} from 'material-ui/styles'
import materialTheme from '../styles/material-theme.desktop'
import dumbComponentMap from '../dev/dumb-component-map.desktop'
import DumbSheetItem from '../dev/dumb-sheet-item'

const PADDING = 25

ipcRenderer.on('display', (ev, msg) => {
  const map = dumbComponentMap[msg.key]
  const mockKey = msg.mockKey

  const displayTree = (
    <MuiThemeProvider muiTheme={materialTheme}>
      <DumbSheetItem
        key={mockKey}
        id='rendered'
        style={{alignSelf: 'flex-start', margin: PADDING}}
        component={map.component}
        mockKey={mockKey}
        mock={map.mocks[mockKey]}
      />
    </MuiThemeProvider>
  )

  const appEl = document.getElementById('app')
  ReactDOM.render(displayTree, appEl, () => {
    // Remove pesky blinking cursors
    if (document.activeElement.tagName === 'INPUT') {
      window.blur()
    }

    // Unfortunately some resources lazy load after they're rendered.  We need
    // to give the renderer time to load.  After trying process.nextTick,
    // requestAnimationFrame, etc., simply putting in a time delay worked best.
    setTimeout(() => {
      const renderedEl = document.getElementById('rendered')
      const box = renderedEl.getBoundingClientRect()
      const rect = {
        x: box.left - PADDING,
        y: box.top - PADDING,
        width: Math.floor(box.width) + 2 * PADDING,
        height: Math.floor(box.height + 2 * PADDING),
      }

      ev.sender.send('display-done', {rect, ...msg})
    }, 250)
  })
})

declare class ExtendedDocument extends Document {
  fonts: {
    ready: Promise
  }
}
declare var document: ExtendedDocument

window.addEventListener('load', () =>
  document.fonts.ready.then(() =>
    ipcRenderer.send('visdiff-ready')
  )
)
