// `seconds` should be left as 0 for type inherit and retain
import * as I from 'immutable'
export type _RetentionPolicy = {
  type: 'inherit' | 'expire' | 'explode' | 'retain'
  seconds: number
  title: string
}
export type RetentionPolicy = I.RecordOf<_RetentionPolicy>
