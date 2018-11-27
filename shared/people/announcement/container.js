// @flow
import Announcement from '.'
import * as Types from '../../constants/types/people'
import {namedConnect} from '../../util/container'

type OwnProps = {|
  appLink: ?Types.AppLink,
  badged: boolean,
  confirmLabel: ?string,
  dismissable: boolean,
  iconUrl: ?string,
  text: string,
  url: ?string,
|}

const mapStateToProps = () => ({})
// TODO
const mapDispatchToProps = () => ({
  onConfirm: () => {
    console.log('announcement onConfirm TODO')
  },
  onDismiss: () => {
    console.log('announcement onDismiss TODO')
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  badged: ownProps.badged,
  confirmLabel: ownProps.confirmLabel,
  iconUrl: ownProps.iconUrl,
  onConfirm: dispatchProps.onConfirm,
  onDismiss: ownProps.dismissable ? dispatchProps.onDismiss : null,
  text: ownProps.text,
  url: ownProps.url,
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'Announcement'
)(Announcement)
