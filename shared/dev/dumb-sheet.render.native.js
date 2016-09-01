// @flow
import React, {Component} from 'react'
import debounce from 'lodash/debounce'
import dumbComponentMap from './dumb-component-map.native'
import type {Props} from './dumb-sheet.render'
import {Box, Text, SmallInput, Button, NativeScrollView, Icon} from '../common-adapters/index.native'
import {globalStyles, globalColors} from '../styles'

class Render extends Component<void, Props, any> {
  state: any;
  _onFilterChange: (a: any) => void;
  _onFilterChangeProp: (a: any) => void;
  _max: number;

  constructor (props: Props) {
    super(props)

    this.state = {
      filterShow: false,
      localFilter: props.dumbFilter || '',
      testIndex: 0,
    }

    this._onFilterChangeProp = debounce(filter => {
      this.props.onDebugConfigChange({
        dumbFilter: filter,
      })
    }, 300)

    this._onFilterChange = filter => {
      this.setState({localFilter: filter})
      this._onFilterChangeProp(filter)
    }

    this._max = Object.keys(dumbComponentMap).reduce((acc, cur) => {
      return acc + Object.keys(dumbComponentMap[cur].mocks).length
    }, 0)
  }

  _increment () {
    if (this.props.autoIncrement && this.state.testIndex !== -1) {
      const {componentsOnly} = this._getComponents()
      if (this.state.testIndex >= componentsOnly.length) {
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

  _getComponents (filter: ?string) {
    const components = []
    const componentsOnly = []
    const parentPropsOnly = []

    Object.keys(dumbComponentMap).forEach(key => {
      if (filter && key.toLowerCase().indexOf(filter) === -1) {
        return
      }

      const map = dumbComponentMap[key]
      const Component = map.component
      Object.keys(map.mocks).forEach((mockKey, idx) => {
        const mock = {...map.mocks[mockKey]}
        const parentProps = mock.parentProps
        mock.parentProps = undefined

        components.push(
          <Box key={mockKey} style={styleBox}>
            <Text type='BodyXSmall'>{key}: {mockKey}</Text>
            <Box {...parentProps}>
              <Component key={mockKey} {...mock} />
            </Box>
          </Box>
        )
        componentsOnly.push(<Component key={mockKey} {...mock} />)
        parentPropsOnly.push(parentProps)
      })
    })

    return {
      components,
      componentsOnly,
      parentPropsOnly,
    }
  }

  renderIncrement () {
    if (this.state.testIndex === -1) {
      return <Text type='Body'>DONE TESTING</Text>
    }
    const {componentsOnly} = this._getComponents()
    const sub = componentsOnly.slice(this.state.testIndex, this.state.testIndex + 1)
    console.log('test render idx', this.state.testIndex)
    return <Box>{sub}</Box>
  }

  renderSingle () {
    const filter = this.props.dumbFilter.toLowerCase()
    const {components, componentsOnly, parentPropsOnly} = this._getComponents(filter)

    const ToShow = components[this.props.dumbIndex % components.length]

    if (this.props.dumbFullscreen) {
      return (
        <Box style={{flex: 1}} {...parentPropsOnly[this.props.dumbIndex % components.length]}>
          {componentsOnly[this.props.dumbIndex % components.length]}
          <Icon type='iconfont-import' style={{position: 'absolute', top: 20, right: 0}} onClick={() => {
            this.props.onDebugConfigChange({dumbFullscreen: !this.props.dumbFullscreen})
          }} />
        </Box>
      )
    }

    return (
      <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
        <Box style={stylesControls}>
          <SmallInput
            label='Filter:'
            style={inputStyle}
            onChange={filter => this._onFilterChange(filter.toLowerCase())}
            hintText=''
            autoCorrect={false}
            autoCapitalize='none'
            value={this.state.localFilter} />
          <Button type='Primary' style={stylesButton} label='-' onClick={() => { this._incremement(false) }} />
          <SmallInput
            label=''
            style={{width: 50}}
            value={String(this.props.dumbIndex)}
            onChange={filter => this.props.onDebugConfigChange({
              dumbIndex: parseInt(filter, 10) || 0,
            })}
            hintText=''
            autoCorrect={false}
            autoCapitalize='none'
          />
          <Button type='Primary' style={stylesButton} label='+' onClick={() => { this._incremement(true) }} />
          <Icon type='iconfont-device' style={{color: globalColors.blue}} onClick={() => {
            this.props.onDebugConfigChange({dumbFullscreen: !this.props.dumbFullscreen})
          }} />
        </Box>
        <NativeScrollView>
          {ToShow}
        </NativeScrollView>
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

const inputStyle = {
  marginLeft: 10,
  marginRight: 10,
  flex: 1,
  backgroundColor: '#eeeeee',
  borderWidth: 1,
}

const stylesControls = {
  ...globalStyles.flexBoxRow,
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
  paddingBottom: 0,
  borderRadius: 10,
}

export default Render
