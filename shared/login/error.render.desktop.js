import React from 'react'
import {Text} from '../common-adapters'

/* eslint-disable react/prop-types */
export default props => <Text type='Body'>Error loading component {JSON.stringify(props.currentPath.toJS())}</Text>
