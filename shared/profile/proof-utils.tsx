import type * as T from '@/constants/types'

const isValidBitcoinAddress = (username: string) => {
  const legacyFormat = username.search(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/) !== -1
  const segwitFormat =
    username.toLowerCase().search(/^(bc1)[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{11,71}$/) !== -1
  return legacyFormat || segwitFormat
}

export const normalizeProofUsername = (
  platform: T.More.PlatformsExpandedType | undefined,
  username: string
) => {
  let normalized = username
  let valid = true

  switch (platform) {
    case 'http':
    case 'https':
      normalized = normalized.replace(/^.*?:\/\//, '').replace(/:.*/, '').replace(/\/.*/, '')
      break
    case 'btc':
      valid = isValidBitcoinAddress(normalized)
      break
    default:
      break
  }

  return {normalized, valid}
}
