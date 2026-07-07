import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {useDefaultChannels} from '../team/settings-tab/default-channels'
import {ChannelsWidget} from '../common'
import {pluralize} from '@/util/string'
import {setWizardDefaultChannels, type AddMembersWizard} from './state'

// which channels the invitees will land in, with an optional channel picker
const DefaultChannels = ({
  teamID,
  updateWizard,
  wizard,
}: {
  teamID: T.Teams.TeamID
  updateWizard: (wizard: AddMembersWizard) => void
  wizard: AddMembersWizard
}) => {
  const {defaultChannels, defaultChannelsWaiting} = useDefaultChannels(teamID)
  const addToChannels = wizard.addToChannels
  const allKeybaseUsers = !wizard.addingMembers.some(member => member.assertion.includes('@'))
  const onChangeFromDefault = () => updateWizard(setWizardDefaultChannels(wizard, []))
  const onAdd = (toAdd: ReadonlyArray<T.Teams.ChannelNameID>) => {
    updateWizard(setWizardDefaultChannels(wizard, toAdd))
  }
  const onRemove = (toRemove: T.Teams.ChannelNameID) => {
    updateWizard(setWizardDefaultChannels(wizard, undefined, toRemove))
  }
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} gap="xtiny">
      <Kb.Text type="BodySmallSemibold">Join channels</Kb.Text>
      <Kb.Box2 direction="vertical" fullWidth={true}>
        {defaultChannelsWaiting ? (
          <Kb.ProgressIndicator />
        ) : (
          <>
            <Kb.Text type="BodySmall">
              {allKeybaseUsers ? 'Your invitees' : 'Invitees that are Keybase users'} will be added to{' '}
              {defaultChannels.length} {pluralize('channel', defaultChannels.length)}.
            </Kb.Text>
            <Kb.Text type="BodySmall">
              {defaultChannels.map((channel, index) => (
                <Kb.Text key={channel.conversationIDKey} type="BodySmallSemibold">
                  #{channel.channelname}
                  {defaultChannels.length > 2 && index < defaultChannels.length - 1 && ', '}
                  {index === defaultChannels.length - 2 && <Kb.Text type="BodySmall"> and </Kb.Text>}
                </Kb.Text>
              ))}
              .{' '}
              {!addToChannels && (
                <Kb.Text type="BodySmallPrimaryLink" onClick={onChangeFromDefault}>
                  Add channels
                </Kb.Text>
              )}
            </Kb.Text>
          </>
        )}
      </Kb.Box2>
      {addToChannels && (
        <ChannelsWidget
          disableGeneral={true}
          teamID={teamID}
          channels={addToChannels}
          disabledChannels={defaultChannels}
          onAddChannel={onAdd}
          onRemoveChannel={onRemove}
        />
      )}
    </Kb.Box2>
  )
}

export default DefaultChannels
