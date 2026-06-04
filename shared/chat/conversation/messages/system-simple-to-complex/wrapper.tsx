import {makeMessageWrapper} from '../wrapper/wrapper'
import type SystemSimpleToComplexType from './container'

export default makeMessageWrapper('systemSimpleToComplex', message => {
  const {default: SystemSimpleToComplex} = require('./container') as {default: typeof SystemSimpleToComplexType}
  return <SystemSimpleToComplex key="systemSimpleToComplex" message={message} />
})
