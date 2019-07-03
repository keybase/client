import * as React from 'react'
import * as Constants from '../../constants/teams'
import * as Kb from '../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {Props} from './index.types'

const CreateChannel = (props: Props) => (
  <Kb.Box>
    {!!props.errorText && <Kb.Banner color="red" text={props.errorText} />}
    <Kb.Box style={_boxStyle}>
      <Kb.Box style={_inputStyle}>
        <Kb.Input
          autoFocus={true}
          hintText="Channel name"
          value={props.channelname}
          onChangeText={channelname => props.onChannelnameChange(channelname)}
        />
      </Kb.Box>
      <Kb.Box style={_inputStyle}>
        <Kb.Input
          autoCorrect={true}
          autoFocus={false}
          hintText="Description or topic (optional)"
          value={props.description}
          onChangeText={description => props.onDescriptionChange(description)}
        />
      </Kb.Box>
      <Kb.ButtonBar>
        <Kb.WaitingButton
          waitingKey={Constants.createChannelWaitingKey(props.teamname)}
          onClick={props.onSubmit}
          label="Save"
        />
      </Kb.ButtonBar>
    </Kb.Box>
  </Kb.Box>
)

const Header = (props: Props) => (
  <Kb.Box style={_headerStyle}>
    <Kb.Box style={{...globalStyles.flexBoxRow, alignItems: 'center', height: 15}}>
      <Kb.Avatar isTeam={true} teamname={props.teamname} size={16} />
      <Kb.Text type="BodySmallSemibold" style={{marginLeft: globalMargins.xtiny}} lineClamp={1}>
        {props.teamname}
      </Kb.Text>
    </Kb.Box>
    <Kb.Text type="BodyBig">New channel</Kb.Text>
  </Kb.Box>
)

const _headerStyle = {
  ...globalStyles.fillAbsolute,
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
}

const _boxStyle = {
  padding: 16,
}

const _inputStyle = {
  marginTop: globalMargins.large,
}

const Wrapper = (props: Props) => <CreateChannel {...props} onBack={undefined} />

export default Kb.HeaderHoc(Wrapper)
