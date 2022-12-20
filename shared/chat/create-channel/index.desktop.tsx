import * as Constants from '../../constants/teams'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import type {Props} from './index'

const CreateChannel = (props: Props) => (
  <Kb.PopupDialog onClose={props.onClose} styleCover={styles.cover} styleContainer={styles.container}>
    <Kb.Box style={{...styles.box, paddingTop: Styles.globalMargins.medium}}>
      <Kb.Avatar isTeam={true} teamname={props.teamname} size={32} />
      <Kb.Text type="BodySmallSemibold" style={{marginTop: Styles.globalMargins.xtiny}}>
        {props.teamname}
      </Kb.Text>
      <Kb.Text
        type="Header"
        style={{marginBottom: Styles.globalMargins.tiny, marginTop: Styles.globalMargins.tiny}}
      >
        New chat channel
      </Kb.Text>
    </Kb.Box>
    {!!props.errorText && (
      <Kb.Banner color="red">
        <Kb.BannerParagraph bannerColor="red" content={props.errorText} />
      </Kb.Banner>
    )}
    <Kb.Box style={styles.box}>
      <Kb.Box style={styles.back} onClick={props.onBack}>
        <Kb.Icon style={styles.backIcon} type="iconfont-arrow-left" />
        <Kb.Text type="BodyPrimaryLink">Back</Kb.Text>
      </Kb.Box>
      <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" gapEnd={true} gapStart={true}>
        <Kb.LabeledInput
          autoFocus={true}
          style={styles.input}
          placeholder="Channel name"
          value={props.channelname}
          onEnterKeyDown={props.onSubmit}
          onChangeText={channelname => props.onChannelnameChange(channelname)}
        />
        <Kb.LabeledInput
          autoFocus={false}
          autoCorrect={true}
          autoCapitalize="sentences"
          multiline={true}
          rowsMin={1}
          rowsMax={10}
          // From go/chat/msgchecker/constants.go#HeadlineMaxLength
          maxLength={280}
          style={styles.input}
          placeholder="Add a description or topic..."
          value={props.description}
          onEnterKeyDown={props.onSubmit}
          onChangeText={description => props.onDescriptionChange(description)}
        />
      </Kb.Box2>
      <Kb.ButtonBar fullWidth={true} style={styles.buttonBar}>
        <Kb.Button type="Dim" onClick={props.onClose} label="Cancel" />
        <Kb.WaitingButton
          waitingKey={Constants.createChannelWaitingKey(props.teamID)}
          onClick={props.onSubmit}
          label="Save"
        />
      </Kb.ButtonBar>
    </Kb.Box>
  </Kb.PopupDialog>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      back: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        left: 32,
        position: 'absolute',
        top: 32,
      },
      backIcon: {
        marginRight: Styles.globalMargins.xtiny,
      },
      box: {
        ...Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        paddingLeft: Styles.globalMargins.large,
        paddingRight: Styles.globalMargins.large,
      },
      buttonBar: {alignItems: 'center'},
      container: {
        maxHeight: 520,
        width: 400,
      },
      cover: {
        alignItems: 'center',
        justifyContent: 'center',
      },
      input: {
        width: '100%',
      },
    } as const)
)

export default CreateChannel
