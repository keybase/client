import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Types from '../../../constants/types/teams'
import * as Container from '../../../util/container'
import * as Styles from '../../../styles'
import * as TeamsGen from '../../../actions/teams-gen'
import {pluralize} from '../../../util/string'
import {ModalTitle} from '../../common'

type Props = {
  onSubmitChannels?: (channels: Array<string>) => void
  teamID?: Types.TeamID
  waiting?: boolean
  banners?: React.ReactNode
}

const cleanChannelname = (name: string) => name.replace(/[^0-9a-zA-Z_-]/, '')

const CreateChannel = (props: Props) => {
  const {onSubmitChannels, waiting} = props
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  const teamID = props.teamID || Types.newTeamWizardTeamID
  const initialChannels = Container.useSelector(s => s.teams.newTeamWizard.channels) ?? [
    'hellos',
    'random',
    '',
  ]

  const [channels, setChannels] = React.useState<Array<string>>([...initialChannels])
  const setChannel = (i: number) => (value: string) => {
    channels[i] = value
    setChannels([...channels])
  }
  const onClear = (i: number) => {
    channels.splice(i, 1)
    setChannels([...channels])
  }
  const onAdd = () => {
    channels.push('')
    setChannels([...channels])
  }

  const filteredChannels = channels.filter(c => c.trim())
  const onContinue = () =>
    onSubmitChannels
      ? onSubmitChannels(filteredChannels)
      : dispatch(TeamsGen.createSetTeamWizardChannels({channels: filteredChannels}))
  const onBack = () => dispatch(nav.safeNavigateUpPayload())

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
    <Kb.Modal
      banners={props.banners}
      backgroundStyle={styles.background}
      header={{
        leftButton: <Kb.Icon type="iconfont-arrow-left" onClick={onBack} />,
        title: <ModalTitle teamID={teamID} title="Create channels" />,
      }}
      mode="DefaultFullHeight"
      footer={{content: submitButton}}
      allowOverflow={true}
    >
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.banner} centerChildren={true}>
        <Kb.Icon type="icon-illustration-teams-channels-460-96" />
      </Kb.Box2>
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        style={styles.body}
        gap={Styles.isMobile ? 'xsmall' : 'tiny'}
      >
        <Kb.Text type="BodySmall">Channels can be joined by anyone in the team, unlike subteams.</Kb.Text>
        <ChannelInput isGeneral={true} />
        {channels.map((value, idx) => (
          <ChannelInput key={idx} onChange={setChannel(idx)} value={value} onClear={() => onClear(idx)} />
        ))}
        <Kb.Button mode="Secondary" icon="iconfont-new" onClick={onAdd} style={styles.addButton} />
        {numChannels === 0 && !props.onSubmitChannels && (
          <Kb.Text type="BodySmall" style={styles.noChannelsText}>
            Your team will be a simple conversation. You can always make it a big team later by adding
            channels.
          </Kb.Text>
        )}
      </Kb.Box2>
    </Kb.Modal>
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
    return <Kb.NewInput value="#general" disabled={true} containerStyle={styles.inputGeneral} />
  }
  return (
    <Kb.NewInput
      value={props.value}
      onChangeText={text => props.onChange(cleanChannelname(text))}
      decoration={<Kb.Icon type="iconfont-remove" onClick={props.onClear} />}
      placeholder="channel"
      prefix="#"
      containerStyle={styles.input}
      maxLength={20}
    />
  )
}

const styles = Styles.styleSheetCreate(() => ({
  addButton: Styles.platformStyles({
    isElectron: {width: 42},
    isMobile: {width: 47},
    isTablet: {alignSelf: 'flex-start'},
  }),
  background: {backgroundColor: Styles.globalColors.blueGrey},
  banner: Styles.platformStyles({
    common: {backgroundColor: Styles.globalColors.blue, height: 96},
    isElectron: {overflowX: 'hidden'},
  }),
  body: {
    ...Styles.padding(Styles.globalMargins.small),
    flex: 1,
  },
  input: {...Styles.padding(Styles.globalMargins.xsmall)},
  inputGeneral: {...Styles.padding(Styles.globalMargins.xsmall), opacity: 0.4},
  noChannelsText: {paddingTop: Styles.globalMargins.tiny, width: '100%'},
}))

export default CreateChannel
