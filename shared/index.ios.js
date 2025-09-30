// React-native tooling assumes this file is here, so we just require our real entry point
import './app/globals.native'
try {
  console.log('------------- ios starting up ------------')
  const {load} = require('./app/index.native')
  load()
  console.log('------------- ios starting up done ------------')
} catch (e) {
  console.log('------------- ios starting up fail ------------', e)
}
