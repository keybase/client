import announcement from './announcement/index.stories'
import followNotification from './follow-notification/index.stories'
import followSuggestions from './follow-suggestions/index.stories'
import inviteFriends from './invite-friends/index.stories'
import todo from './todo/index.stories'
import wotTask from './wot-task/index.stories'

const load = () => {
  followNotification()
  followSuggestions()
  todo()
  announcement()
  inviteFriends()
  wotTask()
}
export default load
