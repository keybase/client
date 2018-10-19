// @flow
import {resolveRootAsURL} from './resolve-root.desktop'

export const injectReactQueryParams = (url: string): string => {
  if (!__DEV__ || process.env.KEYBASE_DISABLE_REACT_PERF) {
    return url
  }

  return `${url}${url.indexOf('?') === -1 ? '?' : '&'}react_perf`
}

export const getRendererHTML = (component: ?string) =>
  resolveRootAsURL(
    'renderer',
    injectReactQueryParams(`renderer${__DEV__ ? '.dev' : ''}.html?${component || ''}`)
  )
