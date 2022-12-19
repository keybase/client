import * as Constants from '../../constants/teams'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import type {Props} from './index'

const CreateChannel = (props: Props) => (
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
          waitingKey={Constants.createChannelWaitingKey(props.teamID)}
          onClick={props.onSubmit}
          label="Save"
        />
      </Kb.ButtonBar>
    </Kb.Box>
  </Kb.Box>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      box: {padding: 16},
      buttonBar: {alignItems: 'center'},
    } as const)
)

const Wrapper = (props: Props) => (
  <Kb.HeaderHocWrapper onBack={props.onBack}>
    <CreateChannel {...props} onBack={undefined} />
  </Kb.HeaderHocWrapper>
)

export default Wrapper
