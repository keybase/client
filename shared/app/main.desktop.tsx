import * as React from 'react'
import * as Container from '../util/container'
import {hot} from 'react-hot-loader/root'
import RouterSwitcheroo from '../router-v2/switcheroo'
import ResetModal from '../login/reset/modal'

type Props = {}

const Main = (_: Props) => {
  const isResetActive = Container.useSelector(state => state.autoreset.active)
  return (
    <>
      <RouterSwitcheroo />
      {isResetActive && <ResetModal />}
    </>
  )
}

const maybeHotMain = __HOT__ ? hot(Main) : Main
export default maybeHotMain
