/* @flow */

import {ipcRenderer} from 'electron'
import React from 'react'
import ReactDOM from 'react-dom'
import {MuiThemeProvider} from 'material-ui/styles'
import materialTheme from '../styles/material-theme.desktop'
import dumbComponentMap from '../dev/dumb-component-map.desktop'
import DumbSheetItem from '../dev/dumb-sheet-item'

const PADDING = 25

const toRender = []
Object.keys(dumbComponentMap).forEach(key => {
  Object.keys(dumbComponentMap[key].mocks).forEach(mockKey => {
    toRender.push({key, mockKey})
  })
})

function renderNextSheet () {
  let onScreen = []
  let lastItem

  function addUntilFull (done) {
    if (!toRender.length) {
      return done()
    }

    const {key, mockKey} = toRender.pop()
    const mapItem = dumbComponentMap[key]

    const displayTree = (
      <MuiThemeProvider muiTheme={materialTheme}>
        <DumbSheetItem
          key={mockKey}
          component={mapItem.component}
          mockKey={mockKey}
          mock={mapItem.mocks[mockKey]}
        />
      </MuiThemeProvider>
    )

    const containerEl = document.createElement('div')
    containerEl.style.display = 'inline-block'
    containerEl.style.verticalAlign = 'top'
    containerEl.style.overflow = 'hidden'
    containerEl.style.position = 'relative'
    containerEl.style.padding = PADDING + 'px'

    canvasEl.appendChild(containerEl)

    ReactDOM.render(displayTree, containerEl, () => {
      const box = containerEl.getBoundingClientRect()

      const item = lastItem = {
        key,
        mockKey,
        rect: {
          x: Math.floor(box.left),
          y: Math.floor(box.top),
          width: Math.floor(box.width),
          height: Math.floor(box.height),
        },
      }

      if (box.right <= window.innerWidth && box.bottom <= window.innerHeight) {
        onScreen.push(item)
        addUntilFull(done)
      } else {
        toRender.push({key, mockKey})
        done(onScreen)
      }
    })
  }

  const appEl = document.getElementById('app')
  const canvasEl = document.createElement('div')
  appEl.innerHTML = ''
  appEl.appendChild(canvasEl)

  addUntilFull(() => {
    if (onScreen.length === 0) {
      ipcRenderer.send('display-error', {err: `Screenshot canvas size too small for "${lastItem.key} - ${lastItem.mockKey}"! Need ${lastItem.rect.width} x ${lastItem.rect.height}, have ${window.innerWidth} x ${window.innerHeight}.`})
      return
    }

    // Unfortunately some resources lazy load after they're rendered.  We need
    // to give the renderer time to load.  After trying process.nextTick,
    // requestAnimationFrame, etc., simply putting in a time delay worked best.
    setTimeout(() => {
      // Remove pesky blinking cursors
      if (document.activeElement.tagName === 'INPUT') {
        window.blur()
      }

      ipcRenderer.send('display-visible', {items: onScreen, done: toRender.length === 0})
    }, 100)
  })
}

declare class ExtendedDocument extends Document {
  fonts: {
    ready: Promise
  }
}
declare var document: ExtendedDocument

window.addEventListener('load', () => {
  ipcRenderer.on('display-next', renderNextSheet)
  document.fonts.ready.then(renderNextSheet)
})
