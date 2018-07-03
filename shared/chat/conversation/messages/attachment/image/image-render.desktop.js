// @flow
import * as React from 'react'
import type {Props} from './image-render.types'
import {collapseStyles} from '../../../../../styles'

export function ImageRender({onLoad, style, src, loaded}: Props) {
  return (
    <img
      onLoad={onLoad}
      draggable="false"
      src={src}
      style={collapseStyles([style, !loaded && {display: 'none'}])}
    />
  )
}

export function imgMaxWidth() {
  return 320
}
