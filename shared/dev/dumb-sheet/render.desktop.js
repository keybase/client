// @flow
import DumbSheetItem from './item'
import React, {Component} from 'react'
import ReactDOM from 'react-dom'
import debounce from 'lodash/debounce'
import dumbComponentMap from './component-map.desktop'
import type {Props} from './render'
import {Box, Text, Input, BackButton} from '../../common-adapters'
import {globalStyles} from '../../styles'

class DumbSheetRender extends Component<void, Props, any> {
  _onFilterChange: (a: any) => void
  _onNext: (a: any, offset: 1 | -1) => void
  _box: any

  constructor(props: Props) {
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
    // Scroll the screen to the top when you are arrowing around using the exact filter match. Kinda
    // hacky and just to make things simple.
    setImmediate(() => {
      ReactDOM.findDOMNode(this.refs.scrollBox).scrollTop = 0
    })
  }

  componentDidMount() {
    // After all child components have loaded (and their autoFocuses, if present, have been triggered)
    // return focus back to the main filter field of the dumb sheet.
    this.refs.filterInput.focus()
  }

  _filterToParams() {
    let filter = this.props.dumbFilter.toLowerCase()
    let numItemsLeftWeCanShowMax = 10

    const itemsMatch = filter.match(/^(.*):(\d+)$/)

    if (itemsMatch && itemsMatch[2]) {
      filter = itemsMatch[1]
      numItemsLeftWeCanShowMax = parseInt(itemsMatch[2], 10)
    }

    let keys
    let isExact

    const exatchMatch = filter.match(/^'(.*)'$/)
    if (exatchMatch && exatchMatch[1]) {
      const toFind = exatchMatch[1]
      keys = Object.keys(dumbComponentMap).filter(
        key => key.toLowerCase() === toFind
      )
      isExact = true
    } else {
      keys = Object.keys(dumbComponentMap).sort()
      isExact = false
    }

    return {
      filter,
      numItemsLeftWeCanShowMax,
      keys,
      isExact,
    }
  }

  render() {
    const {
      filter,
      numItemsLeftWeCanShowMax,
      keys,
      isExact,
    } = this._filterToParams()
    let numItemsLeftWeCanShow = numItemsLeftWeCanShowMax

    return (
      <Box
        style={{...globalStyles.scrollable, flex: 1, padding: 20}}
        ref="scrollBox"
      >
        <BackButton onClick={this.props.onBack} />
        <Box style={{...globalStyles.flexBoxRow}}>
          <Input
            ref="filterInput"
            small={true}
            smallLabel="Filter:"
            value={this.props.dumbFilter}
            onChangeText={text => this._onFilterChange(text.toLowerCase())}
          />
        </Box>
        {keys.map(key => {
          const map = dumbComponentMap[key]
          const includeAllChildren =
            isExact || !filter || key.toLowerCase().indexOf(filter) !== -1
          const items = Object.keys(map.mocks)
            .filter(
              mockKey =>
                !filter ||
                includeAllChildren ||
                (key.toLowerCase() + mockKey.toLowerCase()).indexOf(filter) !==
                  -1
            )
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
              <Box
                style={{
                  ...globalStyles.flexBoxRow,
                  justifyContent: 'space-between',
                  marginBottom: 5,
                }}
              >
                <Text type="Header" onClick={() => this._onNext(key, -1)}>
                  &lt;&nbsp;
                </Text>
                <Text
                  type="Header"
                  onClick={() => this._onFilterChange(`'${key}'`)}
                >
                  {key}
                </Text>
                <Text type="Header" onClick={() => this._onNext(key, 1)}>
                  &nbsp;&gt;
                </Text>
              </Box>
              {items}
              <Box
                style={{
                  ...globalStyles.flexBoxRow,
                  justifyContent: 'space-between',
                  marginTop: 5,
                }}
              >
                <Text type="Header" onClick={() => this._onNext(key, -1)}>
                  &lt;&nbsp;
                </Text>
                <Text type="Header" onClick={() => this._onNext(key, 1)}>
                  &nbsp;&gt;
                </Text>
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

export default DumbSheetRender
