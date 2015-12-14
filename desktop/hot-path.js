import resolveAssets from './resolve-assets'
const hot = process.env.HOT === 'true'

export default path => {
  return (hot ? 'http://localhost:4000/dist/' : resolveAssets('dist') + '/') + path
}
