// @flow
import * as React from 'react'
import type {Props, ReqProps} from './image'

const RequireImage = ({src, style}: ReqProps) => <img src={src} style={style} />
const FileImage = ({src, style, onLoad}: Props) => <img src={src} style={style} onLoad={onLoad} />

export default FileImage
export {RequireImage}
