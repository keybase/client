import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import UserNotice from '../user-notice'
import * as TeamTypes from '../../../../constants/types/teams'
import {typeToLabel} from '../../../../constants/teams'
import {getAddedUsernames} from '../system-users-added-to-conv'
import {indefiniteArticle} from '../../../../util/string'

type Props = {
  isAdmin: boolean
  addee: string
  adder: string
  bulkAdds: Array<string>
  role: TeamTypes.TeamRoleType
  onManageNotifications: () => void
  onViewTeam: () => void
  isTeam: boolean
  teamname: string
  timestamp: number
  you: string
}

const ManageComponent = (props: Props) => {
  const textType = 'BodySmallSemiboldPrimaryLink'
  if (!props.isTeam) {
    return null
  }
  if (props.addee === props.you) {
    return (
      <Kb.Box style={{...Styles.globalStyles.flexBoxColumn}}>
        <Kb.Text onClick={props.onManageNotifications} type={textType}>
          Manage phone and computer notifications
        </Kb.Text>
      </Kb.Box>
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
    props.role === 'bot' || props.role === 'restrictedbot' ? typeToLabel[props.role].toLowerCase() : null
  if (props.addee === props.you) {
    return <YouAddedToTeam {...props} />
  }
  return (
    <UserNotice>
      <Kb.Text type="BodySmall">
        {youOrUsername({capitalize: true, username: props.adder, you: props.you})}added{' '}
        {getAddedUsernames(props.bulkAdds.length === 0 ? [props.addee] : props.bulkAdds)}
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
            style={{color: Styles.globalColors.black_50}}
            type="BodySmallSemiboldSecondaryLink"
          >
            {teamname}
          </Kb.Text>
        )}
        {typeToLabel[props.role] && ` as ${indefiniteArticle(props.role)} ${typeToLabel[role].toLowerCase()}`}
        .
      </Kb.Text>
      <ManageComponent {...props} />
    </UserNotice>
  )
}

export default AddedToTeam
