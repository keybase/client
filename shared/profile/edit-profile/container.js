// @flow
// // TODO deprecate
import * as React from 'react'
import Render from '.'
import {connect} from '../../util/container'
import {createEditProfile} from '../../actions/profile-gen'
import {maxProfileBioChars} from '../../constants/profile'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {HeaderOnMobile} from '../../common-adapters'
import {isMobile} from '../../constants/platform'

type OwnProps = {||}

const mapStateToProps = state => {
  if (!state.config.username) {
    throw new Error("Didn't get username")
  }
  const trackerInfo = state.tracker.userTrackers[state.config.username]
  if (!trackerInfo) {
    throw new Error("Didn't get trackerinfo")
  }
  const userInfo = trackerInfo.userInfo
  const {bio, fullname, location} = userInfo
  return {bio, fullname, location, title: 'Edit Profile'}
}

const mapDispatchToProps = dispatch => ({
  _onSubmit: (bio: string, fullname: string, location: string) =>
    dispatch(createEditProfile({bio, fullname, location})),
  onBack: () => dispatch(RouteTreeGen.createNavigateUp()),
})

const Component = HeaderOnMobile(Render)

type Props = {|
  bio: string,
  fullname: string,
  location: string,
  onBack: () => void,
  _onSubmit: (bio: string, fullname: string, location: string) => void,
  title: string,
|}
type State = {|
  bio: string,
  fullname: string,
  location: string,
|}

class Wrapper extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {bio: this.props.bio, fullname: this.props.fullname, location: this.props.location}
  }

  onBioChange = bio => this.setState({bio})
  onFullnameChange = fullname => this.setState({fullname})
  onLocationChange = location => this.setState({location})
  onSubmit = () => this.props._onSubmit(this.state.bio, this.state.fullname, this.state.location)

  render() {
    const bioLengthLeft = this.state.bio ? maxProfileBioChars - this.state.bio.length : maxProfileBioChars
    const extra = isMobile ? {} : {onCancel: this.props.onBack}

    return (
      <Component
        {...this.props}
        {...this.state}
        {...extra}
        bioLengthLeft={bioLengthLeft}
        onSubmit={this.onSubmit}
        onBioChange={this.onBioChange}
        onFullnameChange={this.onFullnameChange}
        onLocationChange={this.onLocationChange}
      />
    )
  }
}

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(Wrapper)
