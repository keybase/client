import type * as Styles from '@/styles'
import {iconMeta} from './icon.constants-gen'
import type {IconType} from './icon.constants-gen'
import type {Image as RNImageType} from 'react-native'
import type {getAssetPath as getAssetPathType} from '@/constants/platform'

export type ImageIconProps = {
  type: IconType
  style?: Styles.StylesCrossPlatform
  className?: string
  allowLazy?: boolean
}

const typeExtension = (type: IconType) => iconMeta[type].extension || 'png'
const getImagesDir = (type: IconType) => iconMeta[type].imagesDir || 'icons'

const ImageIconDesktop = (props: ImageIconProps) => {
  const {getAssetPath} = require('@/constants/platform') as {getAssetPath: typeof getAssetPathType}
  const {type, style, className, allowLazy = true} = props
  const hasDarkVariant = !!iconMeta[type].nameDark
  const ext = typeExtension(type)
  const imagesDir = getImagesDir(type)

  const srcSet = [1, 2, 3]
    .map(mult => {
      const name = type as string
      const path = getAssetPath('images', imagesDir, name)
      return `${path}${mult > 1 ? `@${mult}x` : ''}.${ext} ${mult}x`
    })
    .join(', ')

  const img = (
    <img
      loading={allowLazy ? 'lazy' : undefined}
      draggable={false}
      className={className}
      style={style as React.CSSProperties}
      srcSet={srcSet}
    />
  )

  if (hasDarkVariant) {
    const darkName = iconMeta[type].nameDark!
    const darkSrcSet = [1, 2, 3]
      .map(mult => {
        const path = getAssetPath('images', imagesDir, darkName)
        return `${path}${mult > 1 ? `@${mult}x` : ''}.${ext} ${mult}x`
      })
      .join(', ')

    return (
      <picture>
        <source srcSet={darkSrcSet} media="(prefers-color-scheme: dark)" />
        {img}
      </picture>
    )
  }

  return img
}

// Hoisted: resolving useColorScheme from require() during render makes the react
// compiler bail (hooks must be the same function on every render). The require is
// guarded so it never executes on desktop.
const {Image: RNImage, useColorScheme} = isMobile
  ? (require('react-native') as {
      Image: typeof RNImageType
      useColorScheme: () => 'light' | 'dark' | null | undefined
    })
  : {Image: undefined, useColorScheme: undefined}

const ImageIconNative = (props: ImageIconProps) => {
  const {type, style} = props
  const isDarkMode = useColorScheme!() === 'dark'

  let source = (isDarkMode && iconMeta[type].requireDark) || iconMeta[type].require
  if (typeof source !== 'number') {
    source = undefined
  }
  if (!source || !RNImage) return null

  return <RNImage source={source} style={style} />
}

const ImageIcon = isMobile ? ImageIconNative : ImageIconDesktop
export default ImageIcon
