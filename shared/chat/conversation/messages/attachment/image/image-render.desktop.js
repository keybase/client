// @flow
import * as React from 'react'

import type {ImageRenderProps} from './image-render'

export function ImageRender({onLoad, style, src}: ImageRenderProps) {
  return <img onLoad={onLoad} draggable="false" src={src} style={style} />
}

export function imgMaxWidth() {
  return 320
}
