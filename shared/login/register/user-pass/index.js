import React, {Component} from 'react'
import {connect} from 'react-redux'
import Render from './index.render'

export default class UserPass extends Component {
  constructor (props) {
    super(props)

    this.state = {
      username: props.username,
      passphrase: props.passphrase
    }
  }

  render () {
    const buttonEnabled = !!(this.state.username && this.state.username.length && this.state.passphrase && this.state.passphrase.length)
    return (
      <Render
        title={this.props.title}
        subTitle={this.props.subTitle}
        error={this.props.error}
        username={this.state.username}
        passphrase={this.state.passphrase}
        onChangeUsername={username => this.setState({username})}
        onChangePassphrase={passphrase => this.setState({passphrase})}
        buttonEnabled={buttonEnabled}
        onSubmit={() => this.props.onSubmit(this.state.username, this.state.passphrase)}
      />
    )
  }
}

UserPass.propTypes = {
  username: React.PropTypes.string,
  passphrase: React.PropTypes.string,
  error: React.PropTypes.object,
  onSubmit: React.PropTypes.func.isRequired,
  title: React.PropTypes.string,
  subTitle: React.PropTypes.string
}

export default connect(
  (state, ownProps) => ownProps.mapStateToProps(state)
)(UserPass)
