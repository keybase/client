import {makeMessageWrapper} from '../wrapper/wrapper'
import SetDescriptionComponent from './container'

export default makeMessageWrapper('setDescription', message => {
  return <SetDescriptionComponent message={message} />
})
