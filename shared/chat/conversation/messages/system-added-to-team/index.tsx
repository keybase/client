import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import UserNotice from '../user-notice'
import type * as T from '@/constants/types'
import {getAddedUsernames} from '../system-users-added-to-conv'
import {indefiniteArticle} from '@/util/string'

type Props = {
  addee: string
  adder: string
  bulkAdds?: ReadonlyArray<string>
  role: T.Teams.MaybeTeamRoleType
  onManageNotifications: () => void
  onViewBot: () => void
  onViewTeam: () => void
  isTeam: boolean
  teamname: string
  timestamp: number
  you: string
  isAdmin: boolean
}

const isBot = (role: T.Teams.MaybeTeamRoleType) => {
  return role === 'bot' || role === 'restrictedbot'
}

const ManageComponent = (props: Props) => {
  const textType = 'BodySmallSemiboldPrimaryLink'
  const bot = isBot(props.role)
  if (!props.isTeam && !bot) {
    return null
  }
  if (props.addee === props.you) {
    return (
      <Kb.Box style={{...Kb.Styles.globalStyles.flexBoxColumn}}>
        <Kb.Text onClick={props.onManageNotifications} type={textType}>
          Manage phone and computer notifications
        </Kb.Text>
      </Kb.Box>
    )
  } else if (bot) {
    return (
      <Kb.Text onClick={props.onViewBot} type={textType}>
        View bot settings
      </Kb.Text>
    )
  } else if (props.isAdmin) {
    return (
      <Kb.Text onClick={props.onViewTeam} type={textType}>
        Manage members
      </Kb.Text>
    )
  } else {
    return (
      <Kb.Text onClick={props.onViewTeam} type={textType}>
        See all members
      </Kb.Text>
    )
  }
}

const youOrUsername = (props: {username: string; you: string; capitalize: boolean; adder?: string}) => {
  if (props.adder === props.you) return 'yourself '
  if (props.username === props.you) {
    return props.capitalize ? 'You ' : 'you '
  }
  return ''
}

const AddedToTeam = (props: Props) => {
  const role =
    props.role !== 'none' && isBot(props.role) ? C.Teams.typeToLabel[props.role].toLowerCase() : null
  if (props.addee === props.you) {
    return <YouAddedToTeam {...props} />
  }
  return (
    <UserNotice>
      <Kb.Text type="BodySmall">
        {youOrUsername({capitalize: true, username: props.adder, you: props.you})}added{' '}
        {getAddedUsernames(props.bulkAdds?.length ? props.bulkAdds : [props.addee])}
        {props.isTeam && ' to the team'}
        {role && ` as ${indefiniteArticle(role)} ${role}`}. <ManageComponent {...props} />
      </Kb.Text>
    </UserNotice>
  )
}

const YouAddedToTeam = (props: Props) => {
  const {teamname, you, onViewTeam, adder, addee, role} = props
  return (
    <UserNotice>
      <Kb.Text type="BodySmall">
        {youOrUsername({capitalize: true, username: adder, you})}added{' '}
        {youOrUsername({adder, capitalize: false, username: addee, you})}
        {teamname && ` to `}
        {teamname && (
          <Kb.Text
            onClick={onViewTeam}
            style={{color: Kb.Styles.globalColors.black_50}}
            type="BodySmallSemiboldSecondaryLink"
          >
            {teamname}
          </Kb.Text>
        )}
        {role !== 'none' &&
          C.Teams.typeToLabel[role] &&
          ` as ${indefiniteArticle(props.role)} ${C.Teams.typeToLabel[role].toLowerCase()}`}
        .
      </Kb.Text>
      <ManageComponent {...props} />
    </UserNotice>
  )
}

export default AddedToTeam
