// @flow
import * as React from 'react'
import type {Props} from './scroll-view'

const ScrollView = (props: Props) => <div {...props} style={{overflow: 'auto', ...props.style}} />

export default ScrollView
