// @flow
import React from 'react'
import {NativeText, NativeImage} from './native-wrappers.native'

const Font = (props: any) => {
  return <NativeText {...props} />
}

const Image = (props: any) => {
  return <NativeImage {...props} />
}

export {Font, Image}
