import {makeMessageWrapper} from '../wrapper/wrapper'
import type SetDescriptionType from './container'

export default makeMessageWrapper('setDescription', message => {
  const {default: SetDescriptionComponent} = require('./container') as {default: typeof SetDescriptionType}
  return <SetDescriptionComponent message={message} />
})
