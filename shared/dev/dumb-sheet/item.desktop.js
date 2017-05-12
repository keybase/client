// @flow
import React, {Component} from 'react'
import ReactDOM from 'react-dom'
import {Provider} from 'react-redux'
import type {Props} from './item'
import {Box, Text} from '../../common-adapters'
import {globalStyles} from '../../styles'
import {createStore} from 'redux'

class DumbSheetItem extends Component<void, Props<*>, void> {
  _component: Component<*, *, *>
  _mockStore: any

  componentDidMount() {
    if (this.props.mock.afterMount) {
      this.props.mock.afterMount(
        this._component,
        ReactDOM.findDOMNode(this._component)
      )
    }
  }

  render() {
    const Component = this.props.component
    // We don't need afterMount here, but don't want it to end up in the ...mock rest object
    // eslint-disable-next-line no-unused-vars
    const {parentProps, afterMount, mockStore, ...mock} = this.props.mock

    const component = (
      <Component
        ref={c => {
          this._component = c
        }}
        {...mock}
      />
    )
    if (mockStore) {
      if (!this._mockStore) {
        this._mockStore = createStore(old => mockStore, mockStore)
      } else {
        // necessary to stop warnings about dynamically replacing the store https://github.com/reactjs/react-redux/releases/tag/v2.0.0
        this._mockStore.replaceReducer(old => mockStore)
      }
    } else {
      this._mockStore = null
    }

    return (
      <Box id={this.props.id} style={{...styleBox, ...this.props.style}}>
        <Text type="Body" style={{marginBottom: 5}}>{this.props.mockKey}</Text>
        <Box {...parentProps}>
          {mockStore
            ? <Provider store={this._mockStore}>{component}</Provider>
            : component}
        </Box>
      </Box>
    )
  }
}

const styleBox = {
  ...globalStyles.flexBoxColumn,
  padding: 20,
  marginTop: 10,
  border: 'solid 1px lightgray',
  boxShadow: '5px 5px lightgray',
}

export default DumbSheetItem
