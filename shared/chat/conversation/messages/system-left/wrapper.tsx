import {makeMessageWrapper} from '../wrapper/wrapper'
import type SystemLeftType from './container'

export default makeMessageWrapper('systemLeft', () => {
  const {default: SystemLeft} = require('./container') as {default: typeof SystemLeftType}
  return <SystemLeft />
})
