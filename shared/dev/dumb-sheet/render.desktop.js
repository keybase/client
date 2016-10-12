// @flow
import DumbSheetItem from './item'
import React, {Component} from 'react'
import ReactDOM from 'react-dom'
import debounce from 'lodash/debounce'
import dumbComponentMap from './component-map.desktop'
import type {Props} from './render'
import {Box, Text, Input, BackButton} from '../../common-adapters'
import {globalStyles} from '../../styles'

class Render extends Component<void, Props, any> {
  _onFilterChange: (a: any) => void;
  _onNext: (a: any, offset: 1 | -1) => void;
  _box: any;

  constructor (props: Props) {
    super(props)

    this._onFilterChange = debounce(filter => {
      this.props.onDebugConfigChange({dumbFilter: filter})
    }, 300)
  }

  _onNext = (key, offset) => {
    const keys = Object.keys(dumbComponentMap).map(k => k.toLowerCase()).sort()
    const idx = keys.indexOf(key.toLowerCase())

    if (idx === -1) {
      return
    }

    const nextIdx = idx + offset

    if (nextIdx < 0 || nextIdx >= keys.length) {
      return
    }

    const filter = `'${keys[nextIdx]}':50`

    this.props.onDebugConfigChange({dumbFilter: filter})
    setImmediate(() => {
      ReactDOM.findDOMNode(this.refs.scrollBox).scrollTop = 0
    })
  }

  componentDidMount () {
    // After all child components have loaded (and their autoFocuses, if present, have been triggered)
    // return focus back to the main filter field of the dumb sheet.
    ReactDOM.findDOMNode(this.refs.filterInput).querySelector('input').focus()
  }

  componentWillReceiveProps (nextProps: Props) {
    // FIXME: desktop <Input> element keeps internal state, need to set its value manually
    this.refs.filterInput.setValue(nextProps.dumbFilter)
  }

  render () {
    const parts = this.props.dumbFilter.toLowerCase().split(':')
    let numItemsLeftWeCanShow = 10
    let filter = parts.join(':')

    if (parts.length > 1) {
      try {
        numItemsLeftWeCanShow = parseInt(parts[parts.length - 1], 10)
        filter = parts.slice(0, parts.length - 1).join(':')
      } catch (_) { }
    }

    let keys
    let exact = false
    // exact match
    if (filter.startsWith("'") && filter.endsWith("'")) {
      const toFind = filter.substring(1, filter.length - 1)
      keys = Object.keys(dumbComponentMap).filter(key => key.toLowerCase() === toFind)
      exact = true
    } else {
      keys = Object.keys(dumbComponentMap).sort()
    }

    return (
      <Box style={{...globalStyles.scrollable, padding: 20}} ref='scrollBox'>
        <BackButton onClick={this.props.onBack} />
        <Box style={{...globalStyles.flexBoxRow}}>
          <Text type='Header'>Filter:</Text>
          <Input
            ref='filterInput'
            value={filter}
            onChange={event => this._onFilterChange(event.target.value.toLowerCase())}
          />
        </Box>
        {keys.map(key => {
          const map = dumbComponentMap[key]
          const includeAllChildren = exact || !filter || key.toLowerCase().indexOf(filter) !== -1
          const items = Object.keys(map.mocks)
            .filter(mockKey => !filter || includeAllChildren || (key.toLowerCase() + mockKey.toLowerCase()).indexOf(filter) !== -1)
            .map((mockKey, idx) => {
              --numItemsLeftWeCanShow

              if (numItemsLeftWeCanShow < 0) return null

              return (
                <DumbSheetItem
                  key={mockKey}
                  component={map.component}
                  mockKey={mockKey}
                  mock={map.mocks[mockKey]}
                />
              )
            })

          if (!items.length) {
            return null
          }

          return (
            <Box key={key} style={styleBox}>
              <Box style={{...globalStyles.flexBoxRow, justifyContent: 'space-between', marginBottom: 5}}>
                <Text type='Header' onClick={() => this._onNext(key, -1)}>&lt;&nbsp;</Text>
                <Text type='Header' onClick={() => this._onFilterChange(`'${key}'`)}>{key}</Text>
                <Text type='Header' onClick={() => this._onNext(key, 1)}>&nbsp;&gt;</Text>
              </Box>
              {items}
              <Box style={{...globalStyles.flexBoxRow, justifyContent: 'space-between', marginTop: 5}}>
                <Text type='Header' onClick={() => this._onNext(key, -1)}>&lt;&nbsp;</Text>
                <Text type='Header' onClick={() => this._onNext(key, 1)}>&nbsp;&gt;</Text>
              </Box>
            </Box>
          )
        })}
      </Box>
    )
  }
}

export const styleBox = {
  ...globalStyles.flexBoxColumn,
  padding: 20,
  marginTop: 10,
  border: 'solid 1px lightgray',
  boxShadow: '5px 5px lightgray',
}

export default Render
