import resolveRoot from './resolve-root'

export default path => {
  /* eslint-disable no-undef */ // Injected by webpack
  return __HOT__ ? `http://localhost:4000/dist/${path}` : resolveRoot('dist', path)
  /* eslint-enable no-undef */
}
