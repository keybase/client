import * as React from 'react'
import * as Constants from '../../constants/teams'
import * as Kb from '../../common-adapters'
import {globalMargins} from '../../styles'
import {Props} from './index.types'

const CreateChannel = (props: Props) => (
  <Kb.Box>
    {!!props.errorText && (
      <Kb.Banner color="red">
        <Kb.BannerParagraph bannerColor="red" content={props.errorText} />
      </Kb.Banner>
    )}
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
          autoCapitalize="sentences"
          multiline={true}
          rowsMin={1}
          rowsMax={4}
          // From go/chat/msgchecker/constants.go#HeadlineMaxLength
          maxLength={280}
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

const _boxStyle = {
  padding: 16,
}

const _inputStyle = {
  marginTop: globalMargins.large,
}

const Wrapper = (props: Props) => <CreateChannel {...props} onBack={undefined} />

export default Kb.HeaderHoc(Wrapper)
