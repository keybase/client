// @flow
import {connector, Main} from './main-shared.native'
import {compose, lifecycle, withProps} from 'recompose'
import {NativeBackHandler} from '../common-adapters/index.native'
import {getPath} from '../route-tree'

module.hot &&
  module.hot.accept(() => {
    console.log('accepted update in main.android')
  })

export default compose(
  withProps(props => ({
    platform: 'Android app',
    version: '0.0.0',
  })),
  connector,
  lifecycle({
    componentWillMount: function() {
      NativeBackHandler.addEventListener('hardwareBackPress', () => {
        if (getPath(this.props.routeState).size === 1) {
          return false
        }
        this.props.navigateUp()
        return true
      })
    },
  })
)(Main)
