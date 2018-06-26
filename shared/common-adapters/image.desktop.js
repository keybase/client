// @flow
import * as React from 'react'
import type {Props} from './image'

export default ({src, style, onLoad}: Props) => <img src={src} style={style} onLoad={onLoad} />
