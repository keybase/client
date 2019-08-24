import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {Wrapper, Input, ContinueButton} from '../common'

type Props = {
  onBack: () => void
  onSubmit: (code: string) => void
  onRequestInvite: () => void
  error: string
}

type State = {
  inviteCode: string
  loading: boolean
}

class InviteCode extends React.Component<Props, State> {
  state = {inviteCode: '', loading: !__STORYSHOT__}
  _loadingID: NodeJS.Timeout | undefined
  _doneLoading = () => this.setState({loading: false})

  componentDidMount() {
    this._loadingID = setTimeout(this._doneLoading, 1000)
  }

  componentWillUnmount() {
    this._loadingID && clearTimeout(this._loadingID)
  }

  _onSubmit = () => {
    this.props.onSubmit(this.state.inviteCode)
  }

  render() {
    return (
      <Wrapper onBack={this.props.onBack}>
        {this.state.loading ? (
          <Kb.ProgressIndicator style={styles.progress} />
        ) : (
          <>
            <Kb.Text type="Header">Type in your invite code:</Kb.Text>
            <Input
              autoFocus={true}
              value={this.state.inviteCode}
              errorText={this.props.error}
              onEnterKeyDown={this._onSubmit}
              onChangeText={inviteCode => this.setState({inviteCode})}
            />
            <ContinueButton disabled={!this.state.inviteCode} onClick={this._onSubmit} />
            <Kb.Text type="BodySmall">Not invited?</Kb.Text>
            <Kb.Text type="BodySmallSecondaryLink" onClick={this.props.onRequestInvite}>
              Request an invite
            </Kb.Text>
          </>
        )}
      </Wrapper>
    )
  }
}

const styles = Styles.styleSheetCreate({
  progress: {
    width: 40,
  },
})

export default InviteCode
