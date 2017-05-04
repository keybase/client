// @flow
import React, {Component} from 'react'
import debounce from 'lodash/debounce'
import dumbComponentMap from './component-map.native'
import {Box, Button, Icon, Input, Text} from '../../common-adapters/index.native'
import {Provider} from 'react-redux'
import {createStore} from 'redux'
import {globalStyles, globalColors} from '../../styles'

import type {Props} from './render'

class DumbSheetRender extends Component<void, Props, any> {
  state: any;
  _onFilterChange: (a: any) => void;
  _onFilterChangeProp: (a: any) => void;
  _max: number;
  _mockStore: any;

  constructor (props: Props) {
    super(props)

    this.state = {
      filterShow: false,
      localFilter: props.dumbFilter || '',
      testIndex: 0,
    }

    this._max = Object.keys(dumbComponentMap).reduce((acc, cur) => {
      return acc + Object.keys(dumbComponentMap[cur].mocks).length
    }, 0)
  }

  _onFilterChangeProp = debounce(dumbFilter => {
    this.props.onDebugConfigChange({dumbFilter})
  }, 1000)

  _onFilterChange = localFilter => {
    this.setState({localFilter})
    this._onFilterChangeProp(localFilter)
  }

  _increment () {
    if (this.props.autoIncrement && this.state.testIndex !== -1) {
      const total = this._getTotal(null, -1)
      if (this.state.testIndex >= total) {
        this.setState({testIndex: -1})
      } else {
        this.setState({testIndex: this.state.testIndex + 1})
      }
    }
  }

  componentDidMount () {
    if (this.props.autoIncrement) {
      this._increment()
    }
  }

  componentDidUpdate () {
    if (this.props.autoIncrement) {
      setImmediate(() => {
        this._increment()
      })
    }
  }

  render () {
    return this.props.autoIncrement ? this.renderIncrement() : this.renderSingle()
  }

  _getTotal (filter: ?string) {
    let total = 0
    Object.keys(dumbComponentMap).forEach(key => {
      if (filter && key.toLowerCase().indexOf(filter) === -1) {
        return
      }

      const map = dumbComponentMap[key]
      total += Object.keys(map.mocks).length
    })

    return total
  }

  _getComponent (filter: ?string, renderIdx: number): {component: any, mock: any, key: any, mockKey: ?string} {
    let component = null
    let mock = {}
    let key = null
    let mockKey = null

    let currentIdx = 0
    Object.keys(dumbComponentMap).forEach(k => {
      if (filter && k.toLowerCase().indexOf(filter) === -1) {
        return
      }

      const map = dumbComponentMap[k]
      const Component = map.component

      Object.keys(map.mocks).forEach((_mockKey, idx) => {
        if (renderIdx === currentIdx) {
          key = k
          mockKey = _mockKey
          mock = map.mocks[_mockKey]
          component = <Component key={_mockKey} {...{
            ...map.mocks[_mockKey],
            mockStore: undefined,
            parentProps: undefined,
          }} />
        }
        ++currentIdx
      })
    })

    return {
      component,
      key,
      mock,
      mockKey,
    }
  }

  renderIncrement () {
    if (this.state.testIndex === -1) {
      return <Text type='Body'>DONE TESTING</Text>
    }
    const {component, mock} = this._getComponent(null, this.state.testIndex)

    this._updateMockStore(mock.mockStore)
    console.log('test render idx', this.state.testIndex, component)
    return <Box>{this._makeStoreWrapper(component)}</Box>
  }

  _updateMockStore (mockStore: any) {
    if (mockStore) {
      if (!this._mockStore) {
        this._mockStore = createStore((old) => mockStore, mockStore)
      } else {
        // necessary to stop warnings about dynamically replacing the store https://github.com/reactjs/react-redux/releases/tag/v2.0.0
        this._mockStore.replaceReducer((old) => mockStore)
      }
    } else {
      this._mockStore = null
    }
  }

  _makeStoreWrapper (component) {
    return this._mockStore ? <Provider store={this._mockStore}>{component}</Provider> : component
  }

  renderSingle () {
    const filter = this.props.dumbFilter.toLowerCase()
    const total = this._getTotal(filter)
    const {component, mock, key, mockKey} = this._getComponent(filter, this.props.dumbIndex % total)

    this._updateMockStore(mock.mockStore)

    if (this.props.dumbFullscreen) {
      return (
        <Box style={{flex: 1}}>
          <Box style={{position: 'absolute', top: 0, bottom: 20, right: 0, left: 0}}>
            <Box style={{flex: 1}} {...mock.parentProps}>
              {this._makeStoreWrapper(component)}
            </Box>
          </Box>
          <Box style={{position: 'absolute', bottom: 0, right: 0, ...globalStyles.flexBoxRow}}>
            <Input
              small={true}
              smallLabel='Filter:'
              onChangeText={filter => this._onFilterChange(filter.toLowerCase())}
              autoCapitalize='none'
              value={this.state.localFilter} />
            <Button type='Primary' style={stylesButton} label='-' onClick={() => { this._incremement(false) }} />
            <Input
              small={true}
              inputStyle={{textAlign: 'center'}}
              style={{flex: 0, width: 50}}
              value={String(this.props.dumbIndex)}
              onChangeText={filter => this.props.onDebugConfigChange({
                dumbIndex: parseInt(filter, 10) || 0,
              })}
              autoCapitalize='none'
            />
            <Button type='Primary' style={stylesButton} label='+' onClick={() => { this._incremement(true) }} />
            <Icon type='iconfont-import' onClick={() => {
              this.props.onDebugConfigChange({dumbFullscreen: !this.props.dumbFullscreen})
            }} />
          </Box>
        </Box>
      )
    }

    return (
      <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
        <Box style={globalStyles.flexBoxRow}>
          <Input
            small={true}
            smallLabel='Filter:'
            onChangeText={filter => this._onFilterChange(filter.toLowerCase())}
            autoCapitalize='none'
            value={this.state.localFilter} />
          <Button type='Primary' style={stylesButton} label='-' onClick={() => { this._incremement(false) }} />
          <Input
            small={true}
            inputStyle={{textAlign: 'center'}}
            style={{flex: 0, width: 50}}
            value={String(this.props.dumbIndex)}
            onChangeText={filter => this.props.onDebugConfigChange({
              dumbIndex: parseInt(filter, 10) || 0,
            })}
            autoCapitalize='none'
          />
          <Button type='Primary' style={stylesButton} label='+' onClick={() => { this._incremement(true) }} />
          <Icon type='iconfont-device' style={{color: globalColors.blue}} onClick={() => {
            this.props.onDebugConfigChange({dumbFullscreen: !this.props.dumbFullscreen})
          }} />
        </Box>
        <Box style={styleBox}>
          <Text type='BodySmall'>{key}: {mockKey}</Text>
          <Box style={styleSmallScreen}>
            <Box style={{flex: 1}} {...mock.parentProps}>
              {this._makeStoreWrapper(component)}
            </Box>
          </Box>
        </Box>
      </Box>
    )
  }

  _incremement (up: boolean) {
    let next = this.props.dumbIndex + (up ? 1 : -1)
    if (next < 0) {
      next = this._max - 1
    }
    next = next % (this._max)

    this.props.onDebugConfigChange({
      dumbIndex: next,
    })
  }
}

const styleBox = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
}

const styleSmallScreen = {
  ...globalStyles.flexBoxColumn,
  borderColor: 'black',
  borderWidth: 1,
  flex: 1,
  maxHeight: 528, // Wrap in max height, so we'll know if things get clipped on iPhone SE
}
const stylesButton = {
  borderRadius: 10,
  height: 20,
  margin: 0,
  overflow: 'hidden',
  padding: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  paddingRight: 0,
  paddingTop: 0,
  width: 20,
}

export default DumbSheetRender
