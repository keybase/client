// @flow

export const getOtherErrorInfo = (err: Error) => {
  const info = {}
  for (const k in err) info[k] = (err: Object)[k]
  delete info.name
  delete info.message
  delete info.stack
  return info
}
