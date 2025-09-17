// React-native tooling assumes this file is here, so we just require our real entry point
import './app/globals.native'
try {
  console.log('------------- android starting up ------------')
  const {load} = require('./app/index.native')
  load()
  console.log('------------- android starting up done ------------')
} catch (e) {
  console.log('------------- android starting up fail ------------', e)
}
