import * as React from 'react'
import * as Constants from '../../constants/teams'
import * as Kb from '../../common-adapters'
import {globalStyles, globalColors, globalMargins, platformStyles} from '../../styles'
import {Props} from './index.types'

const CreateChannel = (props: Props) => (
  <Kb.PopupDialog onClose={props.onClose} styleCover={_styleCover} styleContainer={_styleContainer}>
    <Kb.Box style={{..._boxStyle, paddingTop: globalMargins.medium}}>
      <Kb.Avatar isTeam={true} teamname={props.teamname} size={32} />
      <Kb.Text type="BodySmallSemibold" style={{marginTop: globalMargins.xtiny}}>
        {props.teamname}
      </Kb.Text>
      <Kb.Text type="Header" style={{marginBottom: globalMargins.tiny, marginTop: globalMargins.tiny}}>
        New chat channel
      </Kb.Text>
    </Kb.Box>
    {!!props.errorText && (
      <Kb.Banner color="red">
        <Kb.BannerParagraph bannerColor="red" content={props.errorText} />
      </Kb.Banner>
    )}
    <Kb.Box style={_boxStyle}>
      <Kb.Box style={_backStyle} onClick={props.onBack}>
        <Kb.Icon style={_backIcon} type="iconfont-arrow-left" />
        <Kb.Text type="BodyPrimaryLink">Back</Kb.Text>
      </Kb.Box>
      <Kb.Box style={_inputStyle}>
        <Kb.Input
          autoFocus={true}
          style={{minWidth: 450}}
          hintText="Channel name"
          value={props.channelname}
          onEnterKeyDown={props.onSubmit}
          onChangeText={channelname => props.onChannelnameChange(channelname)}
        />
      </Kb.Box>
      <Kb.Box style={_inputStyle}>
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
          hintText="Description or topic (optional)"
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

const _inputStyle = {
  ...globalStyles.flexBoxRow,
  marginTop: globalMargins.medium,
}

const _boxStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  paddingLeft: globalMargins.large,
  paddingRight: globalMargins.large,
}

const _backIcon = platformStyles({
  common: {
    marginRight: globalMargins.xtiny,
  },
  isElectron: {
    display: 'block',
  },
})

const _backStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  left: 32,
  position: 'absolute',
  top: 32,
}

const _styleCover = {
  alignItems: 'center',
  backgroundColor: globalColors.black_50,
  justifyContent: 'center',
}

const _styleContainer = {
  height: 520,
  width: 620,
}

export default CreateChannel
