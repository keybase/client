// @flow
import './style.css'

import React from 'react'
import ReactDOM from 'react-dom'
import {AppContainer} from 'react-hot-loader'
import {GlobalEscapeHandler} from '../../util/escape-handler'

module.hot && module.hot.accept('../../dev/dumb-sheet/render.desktop', render)

class Wrapper extends React.Component<any, any, any> {
  constructor() {
    super()
    this.state = {
      // eslint-disable-next-line
      dumbFilter: localStorage['dumbFilter'] || '',
    }
  }

  render() {
    const {dumbFilter} = this.state
    const {DumbSheet} = this.props
    return (
      <DumbSheet
        onBack={() => {}}
        onDebugConfigChange={c => {
          this.setState(c)
          // eslint-disable-next-line
          localStorage['dumbFilter'] = c.dumbFilter
        }}
        dumbIndex={0}
        dumbFilter={dumbFilter || ''}
        dumbFullscreen={false}
        autoIncrement={false}
      />
    )
  }
}

function render() {
  const DumbSheet = require('../../dev/dumb-sheet/render.desktop').default
  ReactDOM.render(
    <AppContainer>
      <GlobalEscapeHandler>
        <Wrapper DumbSheet={DumbSheet} />
      </GlobalEscapeHandler>
    </AppContainer>,
    document.getElementById('root')
  )
}

function load() {
  render()
}

window.load = load
window.render = render
