import type * as React from 'react'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {pluralize} from '@/util/string'
import * as C from '@/constants'
import {type NewTeamWizard} from './state'
import {AddRowButton, useStringList, WizardBanner, wizardInputStyle} from './common'
import {useNavigation} from '@react-navigation/native'

type Props = {
  initialChannels?: ReadonlyArray<string>
  onSubmitChannels?: (channels: Array<string>) => void
  teamID?: T.Teams.TeamID
  waiting?: boolean
  banners?: React.ReactNode
}

const cleanChannelname = (name: string) => name.replace(/[^0-9a-zA-Z_-]/, '')

export const CreateChannelsModal = (props: Props) => {
  const {onSubmitChannels, waiting} = props
  const initialChannels = props.initialChannels ?? ['hellos', 'random', '']

  const {
    items: channels,
    setItem: setChannel,
    clearItem: onClear,
    addItem: onAdd,
  } = useStringList(initialChannels)

  const filteredChannels = channels.filter(c => c.trim())
  const onContinue = () => onSubmitChannels?.(filteredChannels)
  const numChannels = filteredChannels.length
  // numChannels does not include the #general channel, so take it into account for tha label.
  const continueLabel = onSubmitChannels
    ? `Create ${numChannels + 1} ${pluralize('channel', numChannels + 1)}`
    : numChannels
      ? `Continue with ${numChannels + 1} ${pluralize('channel', numChannels + 1)}`
      : 'Continue without channels'
  const submitButton = (
    <Kb.Button
      fullWidth={true}
      label={continueLabel}
      onClick={onContinue}
      waiting={!!waiting}
      disabled={!!props.onSubmitChannels && numChannels === 0}
    />
  )

  return (
    <>
      {props.banners}
      <WizardBanner icon="icon-illustration-teams-channels-460-96" />
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        flex={1}
        style={styles.body}
        gap={isMobile ? 'xsmall' : 'tiny'}
      >
        <Kb.Text type="BodySmall">Channels can be joined by anyone in the team, unlike subteams.</Kb.Text>
        <ChannelInput isGeneral={true} />
        {channels.map((value, idx) => (
          <ChannelInput
            key={idx}
            onChange={value => setChannel(idx, value)}
            value={value}
            onClear={() => onClear(idx)}
          />
        ))}
        <AddRowButton onAdd={onAdd} />
        {numChannels === 0 && !props.onSubmitChannels && (
          <Kb.Text type="BodySmall" style={styles.noChannelsText}>
            Your team will be a simple conversation. You can always make it a big team later by adding
            channels.
          </Kb.Text>
        )}
      </Kb.Box2>
      <Kb.ModalFooter>{submitButton}</Kb.ModalFooter>
    </>
  )
}

type WizardProps = {
  wizard: NewTeamWizard
}

const WizardCreateChannels = ({wizard: initialWizard}: WizardProps) => {
  const navigation = useNavigation('teamWizard5Channels')
  const navigateAppend = C.Router2.navigateAppend
  return (
    <CreateChannelsModal
      initialChannels={initialWizard.channels ?? ['hellos', 'random', '']}
      onSubmitChannels={channels => {
        const wizard = {...initialWizard, channels}
        navigation.setParams({wizard})
        navigateAppend({name: 'teamWizard6Subteams', params: {wizard}})
      }}
    />
  )
}

type ChannelInputProps =
  | {isGeneral: true}
  | {
      isGeneral?: false
      onChange: (value: string) => void
      onClear: () => void
      value: string
    }

const ChannelInput = (props: ChannelInputProps) => {
  if (props.isGeneral) {
    return <Kb.Input3 textType="BodySemibold" value="#general" disabled={true} containerStyle={styles.inputGeneral} />
  }
  const {value, onChange, onClear} = props
  return (
    <Kb.Input3
      textType="BodySemibold"
      value={value}
      onChangeText={(text: string) => onChange(cleanChannelname(text))}
      decoration={<Kb.Icon type="iconfont-remove" onClick={onClear} />}
      placeholder="channel"
      prefix="#"
      containerStyle={styles.input}
      maxLength={20}
    />
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      body: {
        ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
      },
      input: wizardInputStyle,
      inputGeneral: {...wizardInputStyle, opacity: 0.4},
      noChannelsText: {paddingTop: Kb.Styles.globalMargins.tiny, width: '100%'},
    }) as const
)

export default WizardCreateChannels
