import main from './main/index.stories'
import common from './common/index.stories'
import team from './team/index.stories'
import deleteTeam from './delete-team/index.stories'
import editTeamDescription from './edit-team-description/index.stories'
import settings from './team/settings-tab/index.stories'
import retention from './team/settings-tab/retention/index.stories'
import retentionWarning from './team/settings-tab/retention/warning/index.stories'
import roleButton from './role-button/index.stories'
import rolePicker from './role-picker/index.stories'
import tabs from './team/tabs/index.stories'
import rename from './rename-team/index.stories'
import create from './new-team/index.stories'
import member from './team/member/index.stories'
import teamRow from './main/team-row.stories'
import newTeamWizard from './new-team/wizard/index.stories'
import addMembersWizard from './add-members-wizard/index.stories'
import channels from './channel/index.stories'
import confirmModals from './confirm-modals/index.stories'
import emojis from './emojis/index.stories'
import joinFromInvite from './join-team/index.stories'

const load = () => {
  main()
  common()
  emojis()
  team()
  deleteTeam()
  editTeamDescription()
  settings()
  retention()
  retentionWarning()
  roleButton()
  rolePicker()
  tabs()
  rename()
  create()
  member()
  teamRow()
  newTeamWizard()
  addMembersWizard()
  channels()
  confirmModals()
  joinFromInvite()
}

export default load
