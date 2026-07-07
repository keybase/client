import type {IconType} from './icon.constants-gen'
import {iconMeta} from './icon.constants-gen'

export function isValidIconType(inputType: string): inputType is IconType {
  if (!inputType) return false
  const iconType = inputType as IconType
  return !!iconMeta[iconType]
}
