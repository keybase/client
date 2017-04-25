// @flow
import type {NoErrorTypedAction} from './types/flux'

export type ChangedFocus = NoErrorTypedAction<'app:changedFocus', {appFocused: boolean}>
export type AppLink = NoErrorTypedAction<'app:link', {link: string}>
export type Actions = ChangedFocus | AppLink

// Hardcoded from https://keybase.io/.well-known/apple-app-site-association
function validAppLink (url: string): boolean {
  const blacklist = [
    '/.well-known/*',
    '/_/*',
    '/admin-docs/*',
    '/account/billing',
    '/account/billing/*',
    '/blog',
    '/blog/*',
    '/docs/*',
    '/inv/*',
    '/keybase.txt',
    '/pks/*',
    '/jobs',
    '/jobs/*',
    '/triplesec',
    '/warp',
    '/*/sigchain',
    '/*/sigs/*',
    '/*/graph',
    '/*/devices',
    '/*/pgp_keys.asc',
    '/*/key.asc',
  ]

  const TEMP =  !blacklist.some(b => url.includes(b))
  console.log(`aaaa url check ${url} ${TEMP}`)
  return TEMP
}

export {
  validAppLink,
}
