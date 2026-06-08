import {makeMessageWrapper} from '../wrapper/wrapper'
import type SystemChangeAvatarType from '.'

export default makeMessageWrapper('systemChangeAvatar', message => {
  const {default: SystemChangeAvatar} = require('.') as {default: typeof SystemChangeAvatarType}
  return <SystemChangeAvatar message={message} />
})
