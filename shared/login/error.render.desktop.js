import React, {Component} from 'react'
import {Text} from '../common-adapters'

export default props => <Text type='Body'>Error loading component {JSON.stringify(props.currentPath.toJS())}</Text>
