// @flow
import * as React from 'react'
import type {Props} from './image'

export default ({src, style, onDragStart, onLoad}: Props) => (
  <img src={src} style={style} onDragStart={onDragStart} onLoad={onLoad} />
)
