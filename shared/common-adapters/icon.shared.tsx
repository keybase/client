import type {IconType} from './icon.constants-gen'
import {iconMeta} from './icon.constants-gen'

export function typeExtension(type: IconType): string {
  return iconMeta[type].extension || 'png'
}

export function getImagesDir(type: IconType): string {
  return iconMeta[type].imagesDir || 'icons'
}

export function isValidIconType(inputType: string): inputType is IconType {
  if (!inputType) return false
  const iconType = inputType as IconType
  return !!iconMeta[iconType]
}

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
export function getMultsMap(imgMap: {[size: string]: unknown}, targetSize: number): MultMap {
  const ssizes = Object.keys(imgMap)

  if (!ssizes.length) {
    return {}
  }

  const sizeKey = targetSize + ']' + ssizes.join(':')
  if (_getMultsMapCache[sizeKey]) {
    return _getMultsMapCache[sizeKey]
  }

  const sizes = ssizes.map(s => parseInt(s, 10)).sort((a: number, b: number) => a - b)

  const multsMap: MultMap = {
    1: undefined,
    2: undefined,
    3: undefined,
  }

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
