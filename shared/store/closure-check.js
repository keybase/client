function check (path, obj) {
  if (!obj) return
  if (typeof obj !== 'object') return
  Object.keys(obj).forEach(k => {
    if (typeof obj[k] === 'function') {
      console.log('Found closure in store: ', path.join('.') + '.' + k)
    } else {
      check(path.concat([k]), obj[k])
    }
  })
}

export const closureCheck = store => next => action => {
  const result = next(action)
  check([], store.getState())
  return result
}
