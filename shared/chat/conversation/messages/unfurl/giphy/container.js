// @flow
import * as RPCChatTypes from '../../../../../constants/types/rpc-chat-gen'
import {namedConnect} from '../../../../../util/container'
import UnfurlGiphy from '.'

type OwnProps = {|
  unfurl: RPCChatTypes.UnfurlGiphyDisplay,
  onClose?: () => void,
|}

const mapStateToProps = (state, ownProps: OwnProps) => {
  const {unfurl, onClose} = ownProps
  return {
    imageURL: unfurl.image.url,
    faviconURL: unfurl.favicon ? unfurl.favicon.url : undefined,
    onClose,
  }
}

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'UnfurlGiphy'
)(UnfurlGiphy)
