// @flow
import {ipcRenderer} from 'electron'
import React from 'react'
import ReactDOM from 'react-dom'
import {MuiThemeProvider} from 'material-ui/styles'
import materialTheme from '../styles/material-theme.desktop'
import dumbComponentMap from '../dev/dumb-sheet/component-map.desktop'
import DumbSheetItem from '../dev/dumb-sheet/item'

const PADDING = 25

function onDisplay (ev, msg) {
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

  const sendDisplayDone = () => {
    // Unfortunately some resources lazy load after they're rendered.  We need
    // to give the renderer time to load.  After trying process.nextTick,
    // requestAnimationFrame, etc., simply putting in a time delay worked best.
    setTimeout(() => {
      const renderedEl = document.getElementById('rendered')
      if (!renderedEl) {
        ipcRenderer.send('display-error', {...msg})
        return
      }
      const box = renderedEl.getBoundingClientRect()
      const rect = {
        x: box.left - PADDING,
        y: box.top - PADDING,
        width: Math.floor(box.width) + 2 * PADDING,
        height: Math.floor(box.height + 2 * PADDING),
      }

      ipcRenderer.send('display-done', {rect, ...msg})
    }, 1000)
  }

  const appEl = document.getElementById('root')
  try {
    ReactDOM.render(displayTree, appEl, () => {
      // Remove pesky blinking cursors
      if (document.activeElement.tagName === 'INPUT') {
        document.activeElement.blur()
      }

      sendDisplayDone()
    })
  } catch (err) {
    ReactDOM.render(<p>{JSON.stringify(err)}</p>, appEl, () => {
      sendDisplayDone()
    })
  }
}

function run (options) {
  ipcRenderer.on('display', onDisplay)
  onDisplay(null, options.firstDisplay)
}

declare class ExtendedDocument extends Document {
  fonts: {
    ready: Promise<*>,
  },
}
declare var document: ExtendedDocument

window.load = (options) => {
  document.fonts.ready.then(() => run(options))
}
