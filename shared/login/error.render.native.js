import React from 'react-native'
import {Text} from '../common-adapters'

export default props => <Text type='Body'>Error loading component {JSON.stringify(props.currentPath.toJS())}</Text>
