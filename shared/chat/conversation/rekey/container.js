// @noflow
// import * as Types from '../../../constants/types/chat'
// import ParticipantRekey, {type Props as ParticipantRekeyProps} from './participant-rekey'
// import YouRekey, {type Props as YouRekeyProps} from './you-rekey'
// import {
  // compose,
  // branch,
  // renderComponent,
  // renderNothing,
  // connect,
  // type TypedState,
// } from '../../../util/container'
// import {navigateAppend, navigateUp} from '../../../actions/route-tree'
// import {createShowUserProfile} from '../../../actions/profile-gen'
// import {createOpenPopup} from '../../../actions/unlock-folders-gen'

// type Props = ParticipantRekeyProps & YouRekeyProps

// type OwnProps = {
  // selectedConversationIDKey: ?Types.ConversationIDKey,
// }

// type StateProps = {
  // rekeyInfo: ?Types.RekeyInfo,
  // selectedConversationIDKey: ?Types.ConversationIDKey,
// }

// type DispatchProps = {
  // onBack: () => void,
  // onEnterPaperkey: () => void,
  // onRekey: () => void,
  // onShowProfile: (username: string) => void,
// }

// const mapStateToProps = (state: TypedState, {selectedConversationIDKey}: OwnProps): StateProps => {
  // let rekeyInfo = null

  // // TODO
  // // if (selectedConversationIDKey !== Constants.nothingSelected && selectedConversationIDKey) {
  // // rekeyInfo = state.chat.rekeyInfos.get(selectedConversationIDKey)
  // // }

  // return {
    // rekeyInfo,
    // selectedConversationIDKey,
  // }
// }

// const mapDispatchToProps = (dispatch: Dispatch): DispatchProps => ({
  // onBack: () => dispatch(navigateUp()),
  // onEnterPaperkey: () => dispatch(navigateAppend(['enterPaperkey'])),
  // onRekey: () => dispatch(createOpenPopup()),
  // onShowProfile: (username: string) => dispatch(createShowUserProfile({username})),
// })

// const mergeProps = (stateProps: StateProps, dispatchProps: DispatchProps): Props => ({
  // onBack: dispatchProps.onBack,
  // onEnterPaperkey: dispatchProps.onEnterPaperkey,
  // onRekey: dispatchProps.onRekey,
  // onShowProfile: dispatchProps.onShowProfile,
  // rekeyInfo: stateProps.rekeyInfo,
  // selectedConversationIDKey: stateProps.selectedConversationIDKey,
// })

// const Impossible = () => null

// export default compose(
  // connect(mapStateToProps, mapDispatchToProps, mergeProps),
  // branch(
    // props => !!props.rekeyInfo && !!props.rekeyInfo.get('youCanRekey'),
    // // $FlowIssue doesn't like sending onEnterPaperkey into it cause it doens't use it
    // renderComponent(YouRekey)
  // ),
  // branch(
    // props => !!props.rekeyInfo && !!props.rekeyInfo.get('rekeyParticipants').count(),
    // renderComponent(ParticipantRekey)
  // ),
  // renderNothing
// )(Impossible)
