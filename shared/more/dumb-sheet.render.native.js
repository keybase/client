// @flow
import React, {Component} from 'react'
import {Box, Text, Input, Button} from '../common-adapters'
import {globalStyles} from '../styles/style-guide'
import type {DumbMap} from './dumb'

import CommonMap from '../common-adapters/dumb.native'
// import LoginMap from '../login/dumb.desktop'
// import SignupMap from '../login/signup/dumb.desktop'
// import TrackerMap from '../tracker/dumb.desktop'
// import PinentryMap from '../pinentry/dumb.desktop'

import {dumbFilter, dumbIndex} from '../local-debug'
import debounce from 'lodash/debounce'

class Render extends Component<void, any, any> {
  state: any;
  _onFilterChange: (a: any) => void;

  constructor (props: any) {
    super(props)

    this.state = {
      filter: (dumbFilter && dumbFilter.toLowerCase()) || '',
      filterShow: false,
      index: dumbIndex || 0
    }

    this._onFilterChange = debounce(filter => {
      this.setState({filter})
    }, 300)
  }

  render () {
    const componentMap: DumbMap = {
      ...CommonMap
      // ...LoginMap,
      // ...SignupMap,
      // ...TrackerMap,
      // ...PinentryMap
    }

    const components = []

    Object.keys(componentMap).forEach(key => {
      if (this.state.filter && key.toLowerCase().indexOf(this.state.filter) === -1) {
        return
      }

      const map = componentMap[key]
      const Component = map.component
      Object.keys(map.mocks).map((mockKey, idx) => {
        const mock = {...map.mocks[mockKey]}
        const parentProps = mock.parentProps
        mock.parentProps = undefined

        components.push(
          <Box key={mockKey} style={styleBox}>
            <Text type='Body' style={{marginBottom: 5}}>{mockKey}</Text>
            <Box {...parentProps}>
              <Component key={mockKey} {...mock} />
            </Box>
          </Box>
        )
      })
    })

    const ToShow = components[this.state.index % components.length]

    return (
      <Box>
        {ToShow}
        <Box style={stylesControls}>
          <Text type='BodySmall'>{this.state.index}</Text>
          {this.state.filterShow && <Box style={{...globalStyles.flexBoxColumn, backgroundColor: 'red', height: 40, width: 200}}><Input value={this.state.filter} onChangeText={filter => this._onFilterChange(filter.toLowerCase())}/></Box>}
          <Button type='Primary' style={stylesButton} label='...' onClick={() => { this.setState({filterShow: !this.state.filterShow}) }}/>
          <Button type='Primary' style={stylesButton} label='<' onClick={() => { this._incremement(false) }}/>
          <Button type='Primary' style={stylesButton} label='>' onClick={() => { this._incremement(true) }}/>
        </Box>
      </Box>
    )
  }

  _incremement (up: boolean) {
    let next = Math.max(0, this.state.index + (up ? 1 : -1))
    this.setState({index: next})
  }
}

const styleBox = {
  ...globalStyles.flexBoxColumn,
  padding: 20,
  marginTop: 10
}

const stylesControls = {
  ...globalStyles.flexBoxRow,
  position: 'absolute',
  top: 0,
  right: 0
}

const stylesButton = {
  width: 20,
  height: 20,
  overflow: 'hidden',
  padding: 0,
  margin: 0,
  paddingTop: 0,
  paddingLeft: 0,
  paddingRight: 0,
  paddingBottom: 20,
  borderRadius: 10
}

export default Render
