// @flow
import * as React from 'react'

type ImageRenderProps = {
  onLoad: () => void,
  src: string,
  style: Object,
}

export function ImageRender({onLoad, style, src}: ImageRenderProps) {
  return <img onLoad={onLoad} draggable="false" src={src} style={style} />
}

export function imgMaxWidth() {
  return 320
}
