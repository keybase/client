import React from 'react'
import {Text} from '../common-adapters'
import Immutable from 'immutable'

/* eslint-disable react/prop-types */
export default props => <Text type='Body'>Error loading component {JSON.stringify(props.currentPath.toJS())}</Text>

export const Mocks = {
  'Error': {currentPath: Immutable.Map({a: 1, b: 2, c: 3})},
  'Error2': {currentPath: Immutable.Map({a: 3, b: 2, c: 1})},
}
