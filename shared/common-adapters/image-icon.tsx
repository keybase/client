import * as Styles from '@/styles'
import {iconMeta} from './icon.constants-gen'
import type {IconType} from './icon.constants-gen'
import {typeExtension, getImagesDir} from './icon.shared'
import type {Image as RNImageType} from 'react-native'

export type ImageIconProps = {
  type: IconType
  style?: Styles.StylesCrossPlatform
  allowLazy?: boolean
}

const ImageIconDesktop = (props: ImageIconProps) => {
  const {type, style, allowLazy = true} = props
  const {getAssetPath} = require('@/constants/platform.desktop') as {
    getAssetPath: (...a: Array<string>) => string
  }
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

const ImageIconNative = (props: ImageIconProps) => {
  const {Image: RNImage, useColorScheme} = require('react-native') as {
    Image: typeof RNImageType
    useColorScheme: () => 'light' | 'dark' | null | undefined
  }
  const {type, style} = props
  const isDarkMode = useColorScheme() === 'dark'

  let source = (isDarkMode && iconMeta[type].requireDark) || iconMeta[type].require
  if (typeof source !== 'number') {
    source = undefined
  }
  if (!source) return null

  return <RNImage source={source} style={style as any} />
}

const ImageIcon = Styles.isMobile ? ImageIconNative : ImageIconDesktop
export default ImageIcon
