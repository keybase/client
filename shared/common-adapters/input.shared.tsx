// TODO: PlainInput depends on this file, so migrate it over if/when Input is deprecated.
import {TextInfo} from './input'

const checkTextInfo = ({text, selection}: TextInfo) => {
  if (selection.end === null) {
    throw new Error('selection.end null')
  }
  if (selection.start === null) {
    throw new Error('selection.start null')
  }
  if (selection.end > text.length) {
    throw new Error(`selection end=${selection.end} must be <= text length=${text.length}`)
  }

  if (selection.end < 0) {
    throw new Error(`selection end=${selection.end} must be >= 0`)
  }

  if (selection.start > selection.end) {
    throw new Error(`selection start=${selection.start} must be <= selection end=${selection.end}`)
  }

  if (selection.start < 0) {
    throw new Error(`selection start=${selection.start} must be >= 0`)
  }
}

export {checkTextInfo}
