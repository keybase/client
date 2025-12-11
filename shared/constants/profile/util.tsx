import {isMobile} from '../platform'
import {useRouterState} from '../router2'

export const showUserProfile = (username: string) => {
  if (isMobile) {
    useRouterState.getState().dispatch.clearModals()
  }
  useRouterState.getState().dispatch.navigateAppend({props: {username}, selected: 'profile'})
}
