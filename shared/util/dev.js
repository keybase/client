// @flow

const injectReactQueryParams = (url: string): string => {
  if (!__DEV__) {
    return url
  }

  return `${url}${url.indexOf('?') === -1 ? '?' : '&'}react_perf`
}

export {
  injectReactQueryParams,
}
