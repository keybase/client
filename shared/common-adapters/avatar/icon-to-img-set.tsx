import * as Styles from '@/styles'
import {iconMeta} from '../icon.constants-gen'
import type {IconType} from '../icon.constants-gen'

type MultMap = {
  [1]?: number
  [2]?: number
  [3]?: number
}

const multiKeys = [1, 2, 3] as const

const idealSizeMultMap: {[key: string]: MultMap} = {
  '128': {'1': 256, '2': 256, '3': 960},
  '16': {'1': 192, '2': 192, '3': 192},
  '32': {'1': 192, '2': 192, '3': 192},
  '48': {'1': 192, '2': 192, '3': 192},
  '64': {'1': 192, '2': 256, '3': 192},
  '96': {'1': 192, '2': 192, '3': 960},
}

const _getMultsMapCache: {[key: string]: MultMap} = {}
function getMultsMap(imgMap: {[size: string]: unknown}, targetSize: number): MultMap {
  const ssizes = Object.keys(imgMap)
  if (!ssizes.length) return {}

  const sizeKey = targetSize + ']' + ssizes.join(':')
  if (_getMultsMapCache[sizeKey]) return _getMultsMapCache[sizeKey]

  const sizes = ssizes.map(s => parseInt(s, 10)).sort((a: number, b: number) => a - b)
  const multsMap: MultMap = {1: undefined, 2: undefined, 3: undefined}

  multiKeys.forEach(mult => {
    const level1 = idealSizeMultMap[String(targetSize)]
    if (level1) {
      const level2 = level1[mult]
      if (level2) {
        multsMap[mult] = level2
        return
      }
    }
    const ideal = mult * targetSize
    const size = sizes.find(size => size >= ideal)
    multsMap[mult] = size || sizes.at(-1)
  })

  _getMultsMapCache[sizeKey] = multsMap
  return multsMap
}

function iconTypeToImgSetDesktop(imgMap: {[key: string]: IconType}, targetSize: number) {
  const {getAssetPath} = require('@/constants/platform.desktop') as {getAssetPath: (...a: Array<string>) => string}
  const multsMap = getMultsMap(imgMap, targetSize)
  const keys = Object.keys(multsMap) as unknown as Array<keyof typeof multsMap>
  const sets = keys
    .map(mult => {
      const m = multsMap[mult]
      if (!m) return null
      const img: string = imgMap[m] as string
      if (!img) return null
      const url = getAssetPath('images', 'icons', img)
      return `url('${url}.png') ${mult}x`
    })
    .filter(Boolean)
    .join(', ')
  return sets ? `-webkit-image-set(${sets})` : ''
}

function iconTypeToImgSetNative(imgMap: {[key: string]: IconType}, targetSize: number) {
  const multsMap = getMultsMap(imgMap, targetSize)
  const idealMults = [2, 3, 1] as const
  for (const mult of idealMults) {
    if (multsMap[mult]) {
      const size = multsMap[mult]
      if (!size) return null
      const icon = imgMap[size]
      if (!icon) return null
      return iconMeta[icon].require
    }
  }
  return null
}

export const iconTypeToImgSet: (imgMap: {[key: string]: IconType}, targetSize: number) => string = (
  Styles.isMobile ? iconTypeToImgSetNative : iconTypeToImgSetDesktop
) as any
