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
