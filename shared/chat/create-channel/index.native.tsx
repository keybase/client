import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import type {Props} from './index'
import useHook from './hooks'

const CreateChannel = (p: Props) => {
  const props = useHook(p)
  return (
    <Kb.HeaderHocWrapper onBack={props.onBack}>
      <Kb.Box>
        {!!props.errorText && (
          <Kb.Banner color="red">
            <Kb.BannerParagraph bannerColor="red" content={props.errorText} />
          </Kb.Banner>
        )}
        <Kb.Box style={styles.box}>
          <Kb.Box2 direction="vertical" fullWidth={true} gap="small">
            <Kb.LabeledInput
              autoFocus={true}
              placeholder="Channel name"
              value={props.channelname}
              onChangeText={channelname => props.onChannelnameChange(channelname)}
            />
            <Kb.LabeledInput
              autoCorrect={true}
              autoFocus={false}
              autoCapitalize="sentences"
              multiline={true}
              rowsMin={1}
              rowsMax={2}
              // From go/chat/msgchecker/constants.go#HeadlineMaxLength
              maxLength={280}
              placeholder="Add a description or topic..."
              value={props.description}
              onChangeText={description => props.onDescriptionChange(description)}
            />
          </Kb.Box2>
          <Kb.ButtonBar fullWidth={true} style={styles.buttonBar}>
            <Kb.WaitingButton
              waitingKey={C.waitingKeyTeamsCreateChannel(props.teamID)}
              onClick={props.onSubmit}
              label="Save"
            />
          </Kb.ButtonBar>
        </Kb.Box>
      </Kb.Box>
    </Kb.HeaderHocWrapper>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      box: {padding: 16},
      buttonBar: {alignItems: 'center'},
    }) as const
)

export default CreateChannel
