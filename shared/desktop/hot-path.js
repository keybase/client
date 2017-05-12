// @flow
import {resolveRoot} from './resolve-root'

export default (path: string) => {
  // $FlowIssue
  return __HOT__ // eslint-disable-line no-undef
    ? `http://localhost:4000/dist/${path}`
    : resolveRoot('dist', path)
}
