// @flow
import {connector, Main} from './main-shared.native'
import {compose, withProps} from 'recompose'

module.hot && module.hot.accept(() => {
  console.log('accepted update in main.ios')
})

export default compose(
  withProps(props => ({
    platform: 'iOS app',
    version: '0.0.0',
  })),
  connector
)(Main)
