// @flow
import React from 'react'
import {Text} from '../common-adapters'
import {Map} from 'immutable'

const Render = (props: {currentPath: Object}) => <Text type='Body'>Error loading component {JSON.stringify(props.currentPath.toJS())}</Text>

const Mocks = {
  'Error': {currentPath: Map({a: 1, b: 2, c: 3})},
  'Error2': {currentPath: Map({a: 3, b: 2, c: 1})},
}

export default Render
export {
  Mocks,
}
