// @flow
import * as React from 'react'
import type {Props} from './image-render.types'

export function ImageRender({onLoad, style, src}: Props) {
  return <img onLoad={onLoad} draggable="false" src={src} style={style} />
}

export function imgMaxWidth() {
  return 320
}
