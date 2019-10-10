// `seconds` should be left as 0 for type inherit and retain
export type RetentionPolicy = {
  type: 'inherit' | 'expire' | 'explode' | 'retain'
  seconds: number
  title: string
}
