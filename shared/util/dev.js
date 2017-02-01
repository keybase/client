// @flow

const injectReactQueryParams = (url: string): string => {
  if (!__DEV__ || process.env.KEYBASE_DISABLE_REACT_PERF) {
    return url
  }

  return `${url}${url.indexOf('?') === -1 ? '?' : '&'}react_perf`
}

export {
  injectReactQueryParams,
}
