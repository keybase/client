import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import * as ChatTypes from '../../../../constants/types/chat2'
import * as TeamTypes from '../../../../constants/types/teams'
import {TeamsSubscriberMountOnly} from '../../../../teams/subscriber'

export type ConvProps = {
  fullname: string
  teamType: ChatTypes.TeamType
  teamname: string
  teamID: TeamTypes.TeamID
  ignored: boolean
  muted: boolean
  participants: Array<string>
}

export type Props = {
  attachTo?: () => React.Component<any> | null
  badgeSubscribe: boolean
  canAddPeople: boolean
  convProps?: ConvProps
  isSmallTeam: boolean
  isOnRight?: boolean
  manageChannelsSubtitle: string
  manageChannelsTitle: string
  memberCount: number
  teamname?: string
  visible: boolean
  onAddPeople: () => void
  onBlockConv: () => void
  onHidden: () => void
  onInvite: () => void
  onLeaveTeam: () => void
  onHideConv: () => void
  onMuteConv: (muted: boolean) => void
  onUnhideConv: () => void
  onManageChannels: () => void
  onViewTeam: () => void
}

class InfoPanelMenu extends React.Component<Props> {
  render() {
    const props = this.props
    const addPeopleItems = [
      {
        icon: 'iconfont-mention',
        onClick: props.onAddPeople,
        style: {borderTopWidth: 0},
        subTitle: 'Keybase, Twitter, etc.',
        title: 'Add someone by username',
      },
      {
        icon: 'iconfont-contact-book',
        onClick: props.onInvite,
        title: Styles.isMobile ? 'Add someone from address book' : 'Add someone by email',
      },
    ]
    const channelItem = props.isSmallTeam
      ? {
          icon: 'iconfont-hash',
          onClick: props.onManageChannels,
          subTitle: props.manageChannelsSubtitle,
          title: props.manageChannelsTitle,
        }
      : {
          icon: 'iconfont-hash',
          isBadged: props.badgeSubscribe,
          onClick: props.onManageChannels,
          title: props.manageChannelsTitle,
        }

    const isAdhoc =
      (props.isSmallTeam && !props.convProps) || !!(props.convProps && props.convProps.teamType === 'adhoc')
    const items: Kb.MenuItems = (isAdhoc
      ? [
          this.hideItem(),
          this.muteItem(),
          {danger: true, icon: 'iconfont-block-user', onClick: props.onBlockConv, title: 'Block'},
        ]
      : [
          ...(props.canAddPeople ? addPeopleItems : []),
          {
            icon: 'iconfont-people',
            onClick: props.onViewTeam,
            style: {borderTopWidth: 0},
            title: 'View team',
          },
          this.hideItem(),
          this.muteItem(),
          channelItem,
          {danger: true, icon: 'iconfont-leave', onClick: props.onLeaveTeam, title: 'Leave team'},
          {danger: true, icon: 'iconfont-remove', onClick: props.onBlockConv, title: 'Block team'},
        ]
    ).reduce<Kb.MenuItems>((arr, i) => {
      i && arr.push(i as Kb.MenuItem)
      return arr
    }, [])

    return (
      <>
        {props.visible && <TeamsSubscriberMountOnly />}
        <Kb.FloatingMenu
          attachTo={props.attachTo}
          visible={props.visible}
          items={items}
          onHidden={props.onHidden}
          position={props.isOnRight ? 'bottom right' : 'bottom left'}
          closeOnSelect={true}
        />
      </>
    )
  }

  hideItem() {
    if (this.props.convProps == null) {
      return null
    }
    const convProps = this.props.convProps
    if (convProps.teamType === 'adhoc' || convProps.teamType === 'small') {
      if (convProps.ignored) {
        return {
          icon: 'iconfont-unhide',
          onClick: this.props.onUnhideConv,
          style: {borderTopWidth: 0},
          title: 'Unhide conversation',
        }
      } else {
        return {
          icon: 'iconfont-hide',
          onClick: this.props.onHideConv,
          style: {borderTopWidth: 0},
          subTitle: 'Until next message',
          title: 'Hide conversation',
        }
      }
    } else {
      return null
    }
  }

  muteItem() {
    if (this.props.convProps == null) {
      return null
    }
    const convProps = this.props.convProps
    const title = `${convProps.muted ? 'Unmute' : 'Mute all'} notifications`
    return {
      icon: 'iconfont-shh',
      onClick: () => this.props.onMuteConv(!convProps.muted),
      title,
    }
  }
}

export {InfoPanelMenu}
