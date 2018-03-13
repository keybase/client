// @flow

// These constants could be lumped in routes.js, but some tests need
// to pull in these constants without pulling in a bunch of routes,
// which would pull in Electron.

const loginRouteTreeTitle = 'LoginRoot'

const appRouteTreeTitle = 'AppRoot'

export {loginRouteTreeTitle, appRouteTreeTitle}
