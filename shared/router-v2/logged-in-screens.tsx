import {useConfigState} from '@/stores/config'
import {showLoggedInScreens} from './account-switch'

// Whether the root navigator shows the logged-in screens. The routers' groups and the desktop
// header all read it here so they can't disagree.
export const useLoggedInScreens = () => useConfigState(showLoggedInScreens)
