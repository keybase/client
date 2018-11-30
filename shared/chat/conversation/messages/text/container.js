// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import * as FsTypes from '../../../../constants/types/fs'
import * as FsGen from '../../../../actions/fs-gen'
import TextMessage from '.'
import {namedConnect} from '../../../../util/container'

type OwnProps = {|
  isEditing: boolean,
  message: Types.MessageText,
|}

type WrapperProps = {|
  ...$Exact<OwnProps>,
  onOpenInFilesTab: FsTypes.Path => void,
|}

const Wrapper = (props: WrapperProps) => (
  <TextMessage
    isEditing={props.isEditing}
    mentionsAt={props.message.mentionsAt}
    mentionsChannel={props.message.mentionsChannel}
    mentionsChannelName={props.message.mentionsChannelName}
    text={props.message.text.stringValue()}
    type={props.message.errorReason ? 'error' : props.message.submitState === null ? 'sent' : 'pending'}
    onOpenInFilesTab={props.onOpenInFilesTab}
  />
)

const mapDispatchToProps = dispatch => ({
  onOpenInFilesTab: (path: FsTypes.Path) => dispatch(FsGen.createOpenPathInFilesTab({path})),
})

export default namedConnect<OwnProps, _, _, _, _>(
  () => ({}),
  mapDispatchToProps,
  (s, d, o: OwnProps) => ({...o, ...s, ...d}),
  'TextMessage'
)(Wrapper)
