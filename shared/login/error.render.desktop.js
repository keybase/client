// @flow
import React from 'react'
import {Text} from '../common-adapters'

const Render = (props: {currentPath: Object}) => <Text type='Body'>Error loading component {JSON.stringify(props.currentPath.toJS())}</Text>

export default Render
