import resolveAssets from './resolve-assets'

export default path => {
  /* eslint-disable no-undef */ // Injected by webpack
  return (__HOT__ ? 'http://localhost:4000/dist/' : resolveAssets('dist') + '/') + path
  /* eslint-enable no-undef */
}
