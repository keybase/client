import * as Shared from './shim.shared'
// We don't wrap our components in anything special
export const shim = (routes: any) => Shared.shim(routes, c => c)
