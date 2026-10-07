import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import type {Props} from './index.shared'
import useHook from './hooks'

const CreateChannel = (p: Props) => {
  const props = useHook(p)
  const onEnterKeyDown = isMobile ? undefined : props.onSubmit

  return (
    <Kb.ModalScreen
      banner={
        props.errorText ? (
          <Kb.Banner color="red">
            <Kb.BannerParagraph bannerColor="red" content={props.errorText} />
          </Kb.Banner>
        ) : undefined
      }
      footer={
        <Kb.ConfirmButtons
          split={true}
          waitingKey={C.waitingKeyTeamsCreateChannel(props.teamID)}
          onCancel={props.onBack}
          onConfirm={props.onSubmit}
          confirmLabel="Save"
        />
      }
    >
      <Kb.Box2 direction="vertical" fullWidth={true} gap="small">
        <Kb.Input3
          textType="BodySemibold"
          autoFocus={true}
          placeholder="Channel name"
          value={props.channelname}
          onEnterKeyDown={onEnterKeyDown}
          onChangeText={props.onChannelnameChange}
        />
        <Kb.Input3
          textType="BodySemibold"
          autoFocus={false}
          autoCorrect={true}
          autoCapitalize="sentences"
          multiline={true}
          rowsMin={1}
          rowsMax={isMobile ? 2 : 10}
          maxLength={280}
          placeholder="Add a description or topic..."
          value={props.description}
          onEnterKeyDown={onEnterKeyDown}
          onChangeText={props.onDescriptionChange}
        />
      </Kb.Box2>
    </Kb.ModalScreen>
  )
}

export default CreateChannel
