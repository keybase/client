import {hot} from 'react-hot-loader/root'
import * as React from 'react'
import RouterSwitcheroo from '../router-v2/switcheroo'

type Props = {}

// TODO likely remove this class
class Main extends React.PureComponent<Props> {
  render() {
    return <RouterSwitcheroo />
  }
}

export default hot(Main)
