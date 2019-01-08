// @flow
import * as Constants from '../../constants/tracker2'
import * as Kb from '../../common-adapters'
import * as React from 'react'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/tracker2'

type Props = {|
  bio: string,
  fullname: string,
  location: string,
  title: string,
  onCancel: () => void,
  onSubmit: (bio: string, fullname: string, location: string) => void,
|}

type State = {|
  bio: string,
  fullname: string,
  location: string,
|}

class EditProfile extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      bio: props.bio,
      fullname: props.fullname,
      location: props.location,
    }
  }

  _disabled = () => {
    return (
      (this.state.bio === this.props.bio &&
        this.state.fullname === this.props.fullname &&
        this.state.location === this.props.location) ||
      this.state.bio.length >= 255
    )
  }

  _updateFullname = fullname => this.setState({fullname})
  _updateBio = bio => this.setState({bio})
  _updateLocation = location => this.setState({location})

  _submit = () => {
    this.props.onSubmit(this.state.bio, this.state.fullname, this.state.location)
  }

  render() {
    return (
      <Kb.Box2 direction="vertical" style={styles.container}>
        {Styles.isMobile ? null : (
          <Kb.Text type="Header" style={styles.header}>
            Edit Profile
          </Kb.Text>
        )}
        <Kb.PlainInput
          value={this.state.fullname}
          placeholder="Full name"
          autoFocus={true}
          style={styles.fullname}
          onChangeText={this._updateFullname}
        />
        <Kb.PlainInput
          value={this.state.bio}
          placeholder="Bio"
          style={styles.bio}
          multiline={true}
          rowsMin={7}
          rowsMax={7}
          onChangeText={this._updateBio}
        />
        <Kb.PlainInput
          value={this.state.location}
          placeholder="Location"
          style={styles.location}
          onChangeText={this._updateLocation}
          onEnterKeyDown={this._submit}
        />
        <Kb.Box2 direction="vertical" style={styles.gap} />
        <Kb.WaitingButton
          waitingKey={Constants.waitingKey}
          type="Primary"
          label="Save"
          disabled={this._disabled()}
          onClick={this._submit}
        />
      </Kb.Box2>
    )
  }
}

const styles = Styles.styleSheetCreate({
  bio: {
    borderColor: Styles.globalColors.grey,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderStyle: 'solid',
    padding: Styles.globalMargins.small,
  },
  container: Styles.platformStyles({
    common: {
      padding: Styles.globalMargins.small,
    },
    isElectron: {
      height: 450,
      width: 350,
    },
  }),
  fullname: {
    borderColor: Styles.globalColors.grey,
    borderStyle: 'solid',
    borderTopLeftRadius: Styles.borderRadius,
    borderTopRightRadius: Styles.borderRadius,
    borderWidth: 1,
    padding: Styles.globalMargins.small,
  },
  gap: {flexGrow: 1},
  header: {marginBottom: Styles.globalMargins.small},
  location: {
    borderBottomLeftRadius: Styles.borderRadius,
    borderBottomRightRadius: Styles.borderRadius,
    borderColor: Styles.globalColors.grey,
    borderStyle: 'solid',
    borderWidth: 1,
    padding: Styles.globalMargins.small,
  },
})

export default Kb.HeaderOrPopupWithHeader(EditProfile)
