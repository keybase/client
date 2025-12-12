import {isMobile} from '../platform'
import {storeRegistry} from '../store-registry'

export const showUserProfile = (username: string) => {
  if (isMobile) {
    storeRegistry.getState('router').dispatch.clearModals()
  }
  storeRegistry.getState('router').dispatch.navigateAppend({props: {username}, selected: 'profile'})
}
