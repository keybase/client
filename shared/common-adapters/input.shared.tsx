// TODO: PlainInput depends on this file, so migrate it over if/when Input is deprecated.
import type {TextInfo} from './input'
import './input.css'

const checkTextInfo = ({text, selection}: TextInfo) => {
  const {start, end} = selection
  if (end === null) {
    throw new Error('selection.end null')
  }
  if (start === null) {
    throw new Error('selection.start null')
  }
  if (end > text.length) {
    throw new Error(`selection end=${end} must be <= text length=${text.length}`)
  }

  if (end < 0) {
    throw new Error(`selection end=${end} must be >= 0`)
  }

  if (start > end) {
    throw new Error(`selection start=${start} must be <= selection end=${end}`)
  }

  if (start < 0) {
    throw new Error(`selection start=${start} must be >= 0`)
  }
}

export {checkTextInfo}
