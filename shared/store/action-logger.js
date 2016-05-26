export const actionLogger = store => next => action => {
  console.groupCollapsed && console.groupCollapsed(`Dispatching action: ${action.type}`)
  console.log(`Dispatching action: ${action.type}: ${JSON.stringify(action)} `)
  console.groupEnd && console.groupEnd()
  return next(action)
}
