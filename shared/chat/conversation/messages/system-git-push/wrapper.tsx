import {makeMessageWrapper} from '../wrapper/wrapper'
import type SystemGitPushType from './container'

export default makeMessageWrapper('systemGitPush', message => {
  const {default: SystemGitPush} = require('./container') as {default: typeof SystemGitPushType}
  return <SystemGitPush message={message} />
})
