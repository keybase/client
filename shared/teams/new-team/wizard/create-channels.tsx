import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Container from '../../../util/container'
import * as Styles from '../../../styles'
import {pluralize} from '../../../util/string'
import {ModalTitle} from '../../common'

const cleanChannelname = (name: string) => name.replace(/[^0-9a-zA-Z_-]/, '')

type Props = {
  teamname: string
}

const CreateChannel = (props: Props) => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()

  const [channels, setChannels] = React.useState<Array<string>>(['hellos', 'random', ''])
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

  const onBack = () => dispatch(nav.safeNavigateUpPayload())

  const numChannels = channels.filter(c => !!c.trim()).length
  const continueLabel = numChannels
    ? `Continue with ${numChannels} ${pluralize('channel', numChannels)}`
    : 'Continue without channels'

  return (
    <Kb.Modal
      onClose={onBack}
      header={{
        leftButton: <Kb.Icon type="iconfont-arrow-left" onClick={onBack} />,
        title: <ModalTitle teamname={props.teamname} title="Create channels" />,
      }}
      footer={{content: <Kb.Button fullWidth={true} label={continueLabel} />}}
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
        {numChannels === 0 && (
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
  }),
  banner: {
    backgroundColor: Styles.globalColors.blue,
    height: 96,
  },
  body: Styles.platformStyles({
    common: {
      ...Styles.padding(Styles.globalMargins.small),
      backgroundColor: Styles.globalColors.blueGrey,
    },
    isElectron: {minHeight: 326},
    isMobile: {...Styles.globalStyles.flexOne},
  }),
  input: {...Styles.padding(Styles.globalMargins.xsmall)},
  inputGeneral: {...Styles.padding(Styles.globalMargins.xsmall), opacity: 0.4},
  noChannelsText: {paddingTop: Styles.globalMargins.tiny, width: '100%'},
}))

export default CreateChannel
