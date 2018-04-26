// @flow
import task from './task/index.stories'
import followNotification from './follow-notification/index.stories'
import followSuggestions from './follow-suggestions/index.stories'

const load = () => {
  followNotification()
  followSuggestions()
  task()
}
export default load
