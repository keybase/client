import * as React from 'react'
import {useConfigState} from '@/stores/config'
import {showLoggedInScreens} from './account-switch'

// Computed once, above the navigator, so the logged-in and logged-out groups (and the headers that
// style themselves by it) never disagree.
const LoggedInScreensContext = React.createContext(false)
export const useLoggedInScreens = () => React.useContext(LoggedInScreensContext)

export const LoggedInScreensProvider = ({children}: {children: React.ReactNode}) => (
  <LoggedInScreensContext value={useConfigState(showLoggedInScreens)}>{children}</LoggedInScreensContext>
)
