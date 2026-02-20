import type * as React from 'react'
import {GlobalKeyEventHandler} from '@/common-adapters/key-event-handler.desktop'
import {CanFixOverdrawContext} from '@/styles'

const Root = ({children}: {children: React.ReactNode}) => {
  return (
    <GlobalKeyEventHandler>
      <CanFixOverdrawContext.Provider value={true}>{children}</CanFixOverdrawContext.Provider>
    </GlobalKeyEventHandler>
  )
}

export default Root
