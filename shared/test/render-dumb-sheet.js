// @flow
import {ipcRenderer} from 'electron'
import React from 'react'
import ReactDOM from 'react-dom'
import {MuiThemeProvider} from 'material-ui/styles'
import {GlobalEscapeHandler} from '../util/escape-handler'
import materialTheme from '../styles/material-theme.desktop'
import dumbComponentMap from '../dev/dumb-sheet/component-map.desktop'
import DumbSheetItem from '../dev/dumb-sheet/item'

import '../desktop/renderer/style.css'

const PADDING = 25

function Mock({map, mockKey}) {
  return (
    <MuiThemeProvider muiTheme={materialTheme}>
      <GlobalEscapeHandler>
        <DumbSheetItem
          key={mockKey}
          id="rendered"
          style={{alignSelf: 'flex-start', margin: PADDING}}
          component={map.component}
          mockKey={mockKey}
          mock={map.mocks[mockKey]}
        />
      </GlobalEscapeHandler>
    </MuiThemeProvider>
  )
}

function ErrorMessage({error}) {
  return (
    <div
      id="rendered"
      data-error={true}
      style={{
        alignSelf: 'flex-start',
        border: '5px solid red',
        font: '12px/16px sans-serif',
        padding: 14,
      }}
    >
      <p>{error.stack}</p>
      <p>{JSON.stringify(error)}</p>
    </div>
  )
}

function onDisplay(ev, msg) {
  const appEl = document.getElementById('root')
  if (!appEl) {
    throw new Error('Page missing #root container')
  }

  const map = dumbComponentMap[msg.key]
  const mockKey = msg.mockKey

  const sendDisplayDone = () => {
    // Unfortunately some resources lazy load after they're rendered.  We need
    // to give the renderer time to load.  After trying process.nextTick,
    // requestAnimationFrame, etc., simply putting in a time delay worked best.
    setTimeout(() => {
      let renderedEl = document.getElementById('rendered')
      let isError
      if (!renderedEl) {
        renderedEl = document.createElement('div')
        renderedEl.textContent = 'Error: rendered content missing from page'
        appEl.appendChild(renderedEl)
        isError = true
      } else {
        isError = renderedEl.dataset.error === 'true'
      }

      const box = renderedEl.getBoundingClientRect()
      const rect = {
        x: box.left - PADDING,
        y: box.top - PADDING,
        width: Math.floor(box.width) + 2 * PADDING,
        height: Math.floor(box.height + 2 * PADDING),
      }

      ipcRenderer.send('display-done', {rect, isError, ...msg})
    }, 1000)
  }

  try {
    ReactDOM.render(<Mock map={map} mockKey={mockKey} />, appEl, () => {
      // Remove pesky blinking cursors
      if (
        document.activeElement &&
        (document.activeElement.tagName === 'INPUT' ||
          document.activeElement.tagName === 'TEXTAREA')
      ) {
        document.activeElement && document.activeElement.blur()
      }

      sendDisplayDone()
    })
  } catch (err) {
    ReactDOM.render(<ErrorMessage error={err} />, appEl, () => {
      sendDisplayDone()
    })
  }
}

function run(options) {
  ipcRenderer.on('display', onDisplay)
  onDisplay(null, options.firstDisplay)
}

declare class ExtendedDocument extends Document {
  fonts: {
    ready: Promise<*>,
  },
}
declare var document: ExtendedDocument

window.load = options => {
  document.fonts.ready.then(() => run(options))
}
