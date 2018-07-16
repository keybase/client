// @flow
import * as React from 'react'
import {View} from 'react-native'
import {type Props} from './with-tooltip'

// Tooltip is not supported on mobile.
export default (props: Props) => <View style={props.containerStyle}>{props.children}</View>
