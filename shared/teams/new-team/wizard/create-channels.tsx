import * as React from 'react'
import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {pluralize} from '@/util/string'
import * as C from '@/constants'
import {type NewTeamWizard} from './state'

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

  const [channels, setChannels] = React.useState([...initialChannels])
  const setChannel = (i: number, value: string) => {
    setChannels(prev => prev.map((channel, idx) => (idx === i ? value : channel)))
  }

  const onClear = (i: number) => {
    setChannels(prev => prev.filter((_, idx) => idx !== i))
  }

  const onAdd = () => {
    setChannels(prev => [...prev, ''])
  }

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
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.banner} centerChildren={true}>
        <Kb.ImageIcon type="icon-illustration-teams-channels-460-96" />
      </Kb.Box2>
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        flex={1}
        style={styles.body}
        gap={Kb.Styles.isMobile ? 'xsmall' : 'tiny'}
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
        <Kb.IconButton mode="Secondary" icon="iconfont-new" onClick={onAdd} style={styles.addButton} />
        {numChannels === 0 && !props.onSubmitChannels && (
          <Kb.Text type="BodySmall" style={styles.noChannelsText}>
            Your team will be a simple conversation. You can always make it a big team later by adding
            channels.
          </Kb.Text>
        )}
      </Kb.Box2>
      <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={styles.modalFooter}>{submitButton}</Kb.Box2>
    </>
  )
}

type WizardProps = {
  navigation: {setParams: (params: {wizard: NewTeamWizard}) => void}
  route: {params: {wizard: NewTeamWizard}}
}

const WizardCreateChannels = ({navigation, route}: WizardProps) => {
  const navigateAppend = C.Router2.navigateAppend
  return (
    <CreateChannelsModal
      initialChannels={route.params.wizard.channels ?? ['hellos', 'random', '']}
      onSubmitChannels={channels => {
        const wizard = {...route.params.wizard, channels}
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
    return <Kb.Input3 value="#general" disabled={true} containerStyle={styles.inputGeneral} />
  }
  return (
    <Kb.Input3
      value={props.value}
      onChangeText={(text: string) => props.onChange(cleanChannelname(text))}
      decoration={<Kb.Icon type="iconfont-remove" onClick={props.onClear} />}
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
      addButton: Kb.Styles.platformStyles({
        isElectron: {width: 42},
        isMobile: {width: 47},
        isTablet: {alignSelf: 'flex-start'},
      }),
      banner: Kb.Styles.platformStyles({
        common: {backgroundColor: Kb.Styles.globalColors.blue, height: 96},
        isElectron: {overflowX: 'hidden'},
      }),
      body: {
        ...Kb.Styles.padding(Kb.Styles.globalMargins.small),
      },
      input: {...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall)},
      inputGeneral: {...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall), opacity: 0.4},
      modalFooter: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small),
          borderStyle: 'solid' as const,
          borderTopColor: Kb.Styles.globalColors.black_10,
          borderTopWidth: 1,
          minHeight: 56,
        },
        isElectron: {
          borderBottomLeftRadius: Kb.Styles.borderRadius,
          borderBottomRightRadius: Kb.Styles.borderRadius,
          overflow: 'hidden',
        },
      }),
      noChannelsText: {paddingTop: Kb.Styles.globalMargins.tiny, width: '100%'},
    }) as const
)

export default WizardCreateChannels
