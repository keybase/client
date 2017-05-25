// @flow
import React from 'react'
import {iconMeta} from './icon.constants'
import {NativeText, NativeImage} from './native-wrappers.native'

import type {IconType} from './icon'

const Font = (props: any) => {
  return <NativeText {...props} />
}

const Image = (props: any) => {
  return <NativeImage {...props} />
}

function iconTypeToImgSet(type: IconType) {
  return iconMeta[type].require
}

function urlsToImgSet(imgMap: {[size: string]: string}, size: number): any {
  return Object.keys(imgMap).map(size => ({
    height: parseInt(size, 10),
    uri: imgMap[size],
    width: parseInt(size, 10),
  }))
}

export {Font, Image, iconTypeToImgSet, urlsToImgSet}
