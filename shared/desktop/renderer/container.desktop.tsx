import * as React from 'react'
import {Provider} from 'react-redux'
import {GlobalKeyEventHandler} from '../../util/key-event-handler.desktop'
import {CanFixOverdrawContext, DarkModeContext} from '../../styles'
import * as Container from '../../util/container'
import * as DarkMode from '../../constants/darkmode'
import './style.css'

// if we want to load the read profiler before the app is loaded
const deferLoadingApp = __DEV__ && false

const Root = ({store, children}: any) => {
  const darkMode = DarkMode.useDarkModeState(s => s.isDarkMode())
  return (
    <GlobalKeyEventHandler>
      <CanFixOverdrawContext.Provider value={true}>
        <DarkModeContext.Provider value={darkMode}>
          <Provider store={store}>{children}</Provider>
        </DarkModeContext.Provider>
      </CanFixOverdrawContext.Provider>
    </GlobalKeyEventHandler>
  )
}

const WaitingRoot = (props: any) => {
  const [wait, setWait] = React.useState(true)
  Container.useOnMountOnce(() => {
    setTimeout(() => {
      setWait(false)
    }, 5000)
  })

  if (wait) {
    return null
  }

  return <Root {...props} />
}

export default deferLoadingApp ? WaitingRoot : Root
