import * as Types from '../../../../constants/types/chat2'
import * as Container from '../../../../util/container'
import SystemChangeAvatar from './'

type OwnProps = {
  message: Types.MessageSystemChangeAvatar
}

const Connected = Container.connect(
  (state, _: OwnProps) => ({
    you: state.config.username,
  }),
  () => ({}),
  (stateProps, _dispatchProps, ownProps: OwnProps) => ({
    team: ownProps.message.team,
    user: ownProps.message.user,
    you: stateProps.you,
  })
)(SystemChangeAvatar)

export default Connected
