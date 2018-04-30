// @flow
import main from './main/index.stories.js'
import editTeamDescription from './edit-team-description/index.stories'
import retention from './team/settings-tab/retention/index.stories'
import roles from './role-picker/index.stories'

const load = () => {
  main()
  editTeamDescription()
  retention()
  roles()
}

export default load
