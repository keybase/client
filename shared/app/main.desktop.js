// @flow
import {hot} from 'react-hot-loader/root'
import * as React from 'react'
import RouterSwitcheroo from '../router-v2/switcheroo'
// Uncomment to get more info on hot loading
// import {setConfig} from 'react-hot-loader'
// setConfig({logLevel: 'debug'})

type Props = {||}

// TODO likely remove this class
class Main extends React.PureComponent<Props> {
  render() {
    return <RouterSwitcheroo />
  }
}

export default hot(Main)
