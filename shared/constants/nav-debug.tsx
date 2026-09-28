// Flip to log every navigation the router makes. Its own module so that the router store
// can read it without depending on the navigation adapter.
export const DEBUG_NAV = __DEV__ && (false as boolean)
