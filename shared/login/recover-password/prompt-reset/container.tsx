import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Container from '../../../util/container'
import * as RecoverPasswordGen from '../../../actions/recover-password-gen'
import DeviceSelector from '.'
import {InfoIcon} from '../../../signup/common'

type OwnProps = {}

const ConnectedPromptReset = Container.connect(
  _ => ({}),
  dispatch => ({
    onContinue: (action: boolean) =>
      dispatch(
        RecoverPasswordGen.createSubmitResetPrompt({
          action,
        })
      ),
  }),
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(DeviceSelector)

// @ts-ignore fix this
ConnectedPromptReset.navigationOptions = {
  header: null,
  headerBottomStyle: {height: undefined},
  headerLeft: null, // no back button
  headerRightActions: () => (
    <Kb.Box2
      direction="horizontal"
      style={Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.tiny, 0)}
    >
      <InfoIcon />
    </Kb.Box2>
  ),
}

export default ConnectedPromptReset
