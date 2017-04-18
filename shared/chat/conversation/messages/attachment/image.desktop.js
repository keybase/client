// @flow
import React from 'react'

import type {ImageRenderProps} from './image'

export function ImageRender ({style, src}: ImageRenderProps) {
  return <img draggable='false' src={src} style={style} />
}
