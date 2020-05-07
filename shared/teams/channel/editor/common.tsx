import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Types from '../../../constants/types/teams'
import * as Styles from '../../../styles'
import {ChannelInput, ModalTitle} from '../../common'

export type Props = {
  mode: 'create' | 'edit'
  deleteRenameDisabled?: boolean
  title: string
  banners?: Array<React.ReactNode>

  teamID: Types.TeamID
  loading?: boolean

  channelName: string
  onChangeChannelName: (name: string) => void
  topic: string
  onChangeTopic: (topic: string) => void

  onBack?: () => void
  onClose?: () => void
  waiting: boolean
  onSubmit: () => void
}
export const ChannelEditor = (props: Props) => {
  const submitButton = (
    <Kb.Button
      fullWidth={true}
      label={props.mode === 'create' ? 'Create' : 'Save'}
      onClick={props.onSubmit}
      waiting={props.waiting}
      disabled={props.loading}
    />
  )

  return (
    <Kb.Modal
      backgroundStyle={styles.background}
      banners={props.banners}
      header={{
        leftButton: props.onBack ? <Kb.Icon type="iconfont-arrow-left" onClick={props.onBack} /> : undefined,
        title: <ModalTitle teamID={props.teamID} title={props.title} />,
      }}
      mode="DefaultFullHeight"
      footer={{content: submitButton}}
      allowOverflow={true}
      onClose={props.onClose ?? undefined}
    >
      {props.mode === 'create' && (
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.banner} centerChildren={true}>
          <Kb.Icon type="icon-illustration-teams-channels-460-96" />
        </Kb.Box2>
      )}

      <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" style={styles.body}>
        {props.mode === 'create' && (
          <Kb.Box2 direction="vertical" fullWidth={true}>
            <Kb.Text type="BodySmall">Channels can be joined by anyone in the team, unlike subteams.</Kb.Text>
          </Kb.Box2>
        )}
        {props.deleteRenameDisabled ? (
          <ChannelInput containerStyle={styles.channelInput} isGeneral={props.deleteRenameDisabled} />
        ) : (
          <ChannelInput
            containerStyle={styles.channelInput}
            onChange={props.onChangeChannelName}
            value={props.channelName}
            disabled={props.loading || props.deleteRenameDisabled}
          />
        )}
        <Kb.LabeledInput
          value={props.topic}
          onChangeText={props.onChangeTopic}
          placeholder="Description"
          hoverPlaceholder="What is this channel about?"
          disabled={props.loading}
          multiline={true}
          rowsMin={4}
          rowsMax={4}
          // From go/chat/msgchecker/constants.go#HeadlineMaxLength
          maxLength={280}
        />
      </Kb.Box2>
    </Kb.Modal>
  )
}
export const errorBanner = (errorText: string) =>
  errorText
    ? [
        <Kb.Banner color="red" key="error">
          <Kb.BannerParagraph bannerColor="red" content={errorText} />
        </Kb.Banner>,
      ]
    : []

const styles = Styles.styleSheetCreate(() => ({
  background: {backgroundColor: Styles.globalColors.blueGrey},
  banner: Styles.platformStyles({
    common: {backgroundColor: Styles.globalColors.blue, height: 96},
    isElectron: {overflowX: 'hidden'},
  }),
  body: {
    ...Styles.padding(Styles.globalMargins.small),
    flex: 1,
  },
  channelInput: Styles.platformStyles({
    isElectron: {
      ...Styles.padding(Styles.globalMargins.tiny),
      marginBottom: Styles.globalMargins.tiny,
    },
  }),
}))
