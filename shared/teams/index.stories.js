// @flow
import main from './main/index.stories'
import editTeamDescription from './edit-team-description/index.stories'
import settings from './team/settings-tab/index.stories'
import retention from './team/settings-tab/retention/index.stories'
import retentionWarning from './team/settings-tab/retention/warning/index.stories'
import roles from './role-picker/index.stories'
import tabs from './team/tabs/index.stories'

const load = () => {
  main()
  editTeamDescription()
  settings()
  retention()
  retentionWarning()
  roles()
  tabs()
}

export default load
