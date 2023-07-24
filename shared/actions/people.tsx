import * as Constants from '../constants/people'
import * as RouterConstants from '../constants/router2'
import * as Tabs from '../constants/tabs'

const initPeople = () => {
  RouterConstants.useState.subscribe((s, old) => {
    const next = s.navState
    const prev = old.navState
    if (next === prev) return
    if (
      prev &&
      RouterConstants.getTab(prev) === Tabs.peopleTab &&
      next &&
      RouterConstants.getTab(next) !== Tabs.peopleTab
    ) {
      Constants.useState.getState().dispatch.markViewed()
    }
  })
}

export default initPeople
