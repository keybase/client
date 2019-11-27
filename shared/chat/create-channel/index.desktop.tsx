import * as React from 'react'
import * as Constants from '../../constants/teams'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {Props} from './index'

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
        <Kb.Icon style={styles.back} type="iconfont-arrow-left" />
        <Kb.Text type="BodyPrimaryLink">Back</Kb.Text>
      </Kb.Box>
      <Kb.Box style={styles.input}>
        <Kb.Input
          autoFocus={true}
          style={{minWidth: 450}}
          hintText="Channel name"
          value={props.channelname}
          onEnterKeyDown={props.onSubmit}
          onChangeText={channelname => props.onChannelnameChange(channelname)}
        />
      </Kb.Box>
      <Kb.Box style={styles.input}>
        <Kb.Input
          autoFocus={false}
          autoCorrect={true}
          autoCapitalize="sentences"
          multiline={true}
          rowsMin={1}
          rowsMax={10}
          // From go/chat/msgchecker/constants.go#HeadlineMaxLength
          maxLength={280}
          style={{minWidth: 450}}
          hintText="Add a description or topic..."
          value={props.description}
          onEnterKeyDown={props.onSubmit}
          onChangeText={description => props.onDescriptionChange(description)}
        />
      </Kb.Box>
      <Kb.ButtonBar>
        <Kb.Button type="Dim" onClick={props.onClose} label="Cancel" />
        <Kb.WaitingButton
          waitingKey={Constants.createChannelWaitingKey(props.teamname)}
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
      backIcon: Styles.platformStyles({
        common: {
          marginRight: Styles.globalMargins.xtiny,
        },
        isElectron: {
          display: 'block',
        },
      }),
      box: {
        ...Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        paddingLeft: Styles.globalMargins.large,
        paddingRight: Styles.globalMargins.large,
      },
      container: {
        height: 520,
        width: 620,
      },
      cover: {
        alignItems: 'center',
        backgroundColor: Styles.globalColors.black_50,
        justifyContent: 'center',
      },
      input: {
        ...Styles.globalStyles.flexBoxRow,
        marginTop: Styles.globalMargins.medium,
      },
    } as const)
)

export default CreateChannel
