import * as React from 'react'
import {hot} from 'react-hot-loader/root'
import RouterSwitcheroo from '../router-v2/switcheroo'
import ResetModal from '../login/reset/modal'

const Main = (_: Props) => {
  const isResetActive = Container.useSelector(state => state.autoreset.active)
  return (
    <>
      <RouterSwitcheroo />
      {isResetActive && <ResetModal />}
    </>
  )
}

export default hot(Main)
