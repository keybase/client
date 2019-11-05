import * as Styles from '../styles'
import {IconType, SizeType} from './icon'
import {iconMeta} from './icon.constants-gen'
import './icon.css'

// Some types are the same underlying icon.
export function typeToIconMapper(type: IconType): IconType {
  return type
}

export function typeExtension(type: IconType): string {
  return iconMeta[type].extension || 'png'
}

export function fontSize(type: IconType): {fontSize: number} | null {
  const meta = iconMeta[type]
  if (!meta) {
    throw new Error('Invalid icon type: ' + type)
  }

  const fontSize: number | null = meta.gridSize || null

  if (fontSize) {
    return {fontSize}
  } else {
    return null
  }
}

export function isValidIconType(inputType: string): inputType is IconType {
  // @ts-ignore this type is what we're checking
  let iconType = typeToIconMapper(inputType)
  return !!iconType && !!iconMeta[iconType]
}

export function typeToFontSize(sizeType: SizeType) {
  switch (sizeType) {
    case 'Huge':
      return Styles.isMobile ? 64 : 48
    case 'Bigger':
      return Styles.isMobile ? 48 : 36
    case 'Big':
      return Styles.isMobile ? 32 : 24
    case 'Default':
      return Styles.isMobile ? 20 : 16
    case 'Small':
      return Styles.isMobile ? 16 : 12
    case 'Tiny':
      return Styles.isMobile ? 10 : 8
  }
}

const idealSizeMultMap = {
  '128': {'1': 256, '2': 256, '3': 960},
  '16': {'1': 192, '2': 192, '3': 192},
  '32': {'1': 192, '2': 192, '3': 192},
  '48': {'1': 192, '2': 192, '3': 192},
  '64': {'1': 192, '2': 256, '3': 192},
  '96': {'1': 192, '2': 192, '3': 960},
}

const _getMultsMapCache = {}
export function getMultsMap(imgMap: {[size: string]: any}, targetSize: number): Object {
  const ssizes = Object.keys(imgMap)

  if (!ssizes.length) {
    return {}
  }

  const sizeKey = targetSize + ']' + ssizes.join(':')
  if (_getMultsMapCache[sizeKey]) {
    return _getMultsMapCache[sizeKey] || {}
  }

  const sizes = ssizes.map(s => parseInt(s, 10)).sort((a: number, b: number) => a - b)

  const multsMap: any = {
    '1': null,
    '2': null,
    '3': null,
  }

  Object.keys(multsMap).forEach(mult => {
    // find ideal size if it exist
    const level1 = idealSizeMultMap[String(targetSize)]
    if (level1) {
      const level2 = level1[String(mult)]
      if (level2) {
        multsMap[mult] = level2
        return
      }
    }

    // fallback
    const ideal = parseInt(mult, 10) * targetSize
    const size = sizes.find(size => size >= ideal)
    multsMap[mult] = size || sizes[sizes.length - 1]
  })

  _getMultsMapCache[sizeKey] = multsMap
  return multsMap
}

export function castPlatformStyles(styles: any) {
  return styles
}

function makePaddingStyles() {
  return Object.keys(Styles.globalMargins).reduce(
    (styles, paddingName) => ({
      ...styles,
      [paddingName]: Styles.platformStyles({
        common: {
          padding: Styles.globalMargins[paddingName],
        },
      }),
    }),
    {} as {[K in keyof typeof Styles.globalMargins]: Styles.StylesCrossPlatform}
  )
}

export const paddingStyles: {
  [K in keyof typeof Styles.globalMargins]: Styles.StylesCrossPlatform
} = makePaddingStyles()
