import {previewConversation} from '@/constants/router'
import {useTBContext} from '@/stores/team-building'
import * as Kb from '@/common-adapters'
import CommonResult, {type ResultProps, rowContainerWithLargePadding} from './common-result'

type SelfResultProps = ResultProps & {
  bottomRowText?: string
  selfChatOnAdd?: boolean
}

// Result row for yourself or hellobot. When selfChatOnAdd is set, adding opens
// the conversation instead of adding to the team.
export const SelfResult = (props: SelfResultProps) => {
  const {bottomRowText, selfChatOnAdd, ...rest} = props
  const cancelTeamBuilding = useTBContext(s => s.dispatch.cancelTeamBuilding)
  const onSelfChat = () => {
    cancelTeamBuilding()
    // wait till modal is gone else we can thrash
    setTimeout(() => {
      previewConversation({participants: [rest.username], reason: 'search'})
    }, 500)
  }

  return (
    <CommonResult
      {...rest}
      {...(selfChatOnAdd ? {onAdd: onSelfChat} : {})}
      rowStyle={rowContainerWithLargePadding}
      bottomRow={bottomRowText ? <Kb.Text type="BodySmall">{bottomRowText}</Kb.Text> : null}
    />
  )
}

const YouResult = (props: ResultProps) => {
  switch (props.namespace) {
    case 'teams':
      return (
        <SelfResult
          {...props}
          bottomRowText={props.isPreExistingTeamMember ? 'Already in team' : 'Add yourself to the team'}
        />
      )
    case 'chat':
      return <SelfResult {...props} selfChatOnAdd={true} bottomRowText="Write secure notes to yourself" />
    default:
      return <SelfResult {...props} />
  }
}

export default YouResult
