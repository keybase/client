import {makeMessageWrapper} from '../wrapper/wrapper'
import type SystemChangeRetentionType from './container'

export default makeMessageWrapper('systemChangeRetention', message => {
  const {default: SystemChangeRetention} = require('./container') as {default: typeof SystemChangeRetentionType}
  return <SystemChangeRetention message={message} />
})
