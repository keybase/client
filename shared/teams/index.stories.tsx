import main from './main/index.stories'
import deleteTeam from './delete-team/index.stories'
import editTeamDescription from './edit-team-description/index.stories'
import settings from './team/settings-tab/index.stories'
import reallyLeaveTeam from './really-leave-team/index.stories'
import retention from './team/settings-tab/retention/index.stories'
import retentionWarning from './team/settings-tab/retention/warning/index.stories'
import rolePicker from './role-picker/index.stories'
import tabs from './team/tabs/index.stories'
import rename from './rename-team/index.stories'

const load = () => {
  main()
  deleteTeam()
  editTeamDescription()
  settings()
  reallyLeaveTeam()
  retention()
  retentionWarning()
  rolePicker()
  tabs()
  rename()
}

export default load
