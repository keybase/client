import {makeMessageWrapper} from '../wrapper/wrapper'
import SystemChangeAvatar from '.'

export default makeMessageWrapper('systemChangeAvatar', message => {
  return <SystemChangeAvatar message={message} />
})
