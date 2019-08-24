import todo from './todo/index.stories'
import announcement from './announcement/index.stories'
import followNotification from './follow-notification/index.stories'
import followSuggestions from './follow-suggestions/index.stories'

const load = () => {
  followNotification()
  followSuggestions()
  todo()
  announcement()
}
export default load
