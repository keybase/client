import * as React from 'react'
import {Props} from './image-render.types'
import {collapseStyles} from '../../../../../styles'

export const ImageRender = (props: Props) => (
  <img
    onLoad={props.onLoad}
    draggable={false}
    src={props.src}
    style={collapseStyles([props.style, !props.loaded && {opacity: 0}])}
  />
)

export function imgMaxWidth() {
  return 320
}

export function imgMaxWidthRaw() {
  return 320
}
