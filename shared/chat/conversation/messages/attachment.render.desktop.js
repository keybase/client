// @flow
import React from 'react'

import type {ImageRenderProps} from './attachment.render'

export function ImageRender ({style, src}: ImageRenderProps) {
  return <img src={src} style={style} />
}
