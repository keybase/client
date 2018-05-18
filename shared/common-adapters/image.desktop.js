// @flow
import * as React from 'react'

type Props = {
  src: string,
  style?: any,
}

export default ({src, style}: Props) => <img src={src} style={style} />
