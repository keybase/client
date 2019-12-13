import * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import {IconStyle} from '../../common-adapters/icon'
import {anyVersionsUnseen} from '../../constants/whats-new'
import IconComponent, {IconWithPopup as IconWithPopupComponent} from './index'

type OwnProps = {
  color?: string
  badgeColor?: string
  style?: IconStyle
}

type PopupOwnProps = OwnProps & {
  attachToRef: React.RefObject<Kb.Box2>
}

const mapStateToProps = (state: Container.TypedState) => ({})

// Just Whats New Icon connected for badge state
const IconContainer = Container.connect(
  mapStateToProps,
  () => ({}),
  (stateProps, _, ownProps: OwnProps) => ({
    badgeColor: ownProps.badgeColor,
    color: ownProps.color,
    newRelease: anyVersionsUnseen(stateProps.lastSeenVersion),
    style: ownProps.style,
  })
)(IconComponent)

// Whats New icon with popup which is connected to the badge state and marking release as seen.
export const IconWithPopup = Container.connect(
  (state: Container.TypedState) => ({
    isUpdateAvailable: state.config.updateInfo.status === 'suggested',
    lastSeenVersion: state.config.whatsNewLastSeenVersion,
    updateMessage:
      state.config.updateInfo.status === 'suggested' ? state.config.updateInfo?.suggested?.message : '',
  }),
  () => ({}),
  (stateProps, _, ownProps: PopupOwnProps) => {
    const newRelease = anyVersionsUnseen(stateProps.lastSeenVersion)
    return {
      attachToRef: ownProps.attachToRef,
      badgeColor: ownProps.badgeColor,
      color: ownProps.color,
      isUpdateAvailable: stateProps.isUpdateAvailable,
      newRelease,
      style: ownProps.style,
      updateMessage: stateProps.updateMessage,
    }
  }
)(IconWithPopupComponent)

export default IconContainer
