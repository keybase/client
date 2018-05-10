// @flow
import * as React from 'react'
import {Box2, Button, ClickableBox, FloatingMenu, FollowButton, ButtonBar, Icon} from '../common-adapters'
import {FloatingMenuParentHOC, type FloatingMenuParentProps} from '../common-adapters/floating-menu'
import {normal as proofNormal} from '../constants/tracker'
import {globalColors} from '../styles'
import type {SimpleProofState} from '../constants/types/tracker'

type Props = {
  trackerState: SimpleProofState,
  currentlyFollowing: boolean,
  style: Object,
  onAddToTeam: () => void,
  onBrowsePublicFolder: () => void,
  onChat: () => void,
  onFollow: () => void,
  onOpenPrivateFolder: () => void,
  onUnfollow: () => void,
  onAcceptProofs: () => void,
  waiting: boolean,
}

function UserActions({
  trackerState,
  currentlyFollowing,
  style,
  onAddToTeam,
  onBrowsePublicFolder,
  onChat,
  onFollow,
  onOpenPrivateFolder,
  onUnfollow,
  onAcceptProofs,
  waiting,
}: Props) {
  if (currentlyFollowing) {
    if (trackerState === proofNormal) {
      return (
        <ButtonBar style={style}>
          <FollowButton following={true} onUnfollow={onUnfollow} waiting={waiting} />
          <Button type="Primary" label="Chat" onClick={onChat}>
            <Icon
              type="iconfont-chat"
              style={{
                marginRight: 8,
              }}
              color={globalColors.white}
            />
          </Button>
          <DropdownButton
            onAddToTeam={onAddToTeam}
            onOpenPrivateFolder={onOpenPrivateFolder}
            onBrowsePublicFolder={onBrowsePublicFolder}
          />{' '}
        </ButtonBar>
      )
    } else {
      return (
        <ButtonBar style={style}>
          <Button type="Secondary" label="Unfollow" onClick={onUnfollow} waiting={waiting} />
          <Button type="PrimaryGreen" label="Accept" onClick={onAcceptProofs} />
          <DropdownButton
            onAddToTeam={onAddToTeam}
            onOpenPrivateFolder={onOpenPrivateFolder}
            onBrowsePublicFolder={onBrowsePublicFolder}
          />{' '}
        </ButtonBar>
      )
    }
  } else {
    return (
      <ButtonBar style={style}>
        <FollowButton following={false} onFollow={onFollow} waiting={waiting} />
        <Button label="Chat" type="Primary" onClick={onChat} style={{marginRight: 0}}>
          <Icon
            type="iconfont-chat"
            style={{
              marginRight: 8,
            }}
            color={globalColors.white}
          />
        </Button>
        <DropdownButton
          onAddToTeam={onAddToTeam}
          onOpenPrivateFolder={onOpenPrivateFolder}
          onBrowsePublicFolder={onBrowsePublicFolder}
        />
      </ButtonBar>
    )
  }
}

type DropdownProps = {
  onAddToTeam: () => void,
  onBrowsePublicFolder: () => void,
  onOpenPrivateFolder: () => void,
}

class _DropdownButton extends React.PureComponent<DropdownProps & FloatingMenuParentProps> {
  _menuItems = [
    {
      onClick: () => this.props.onAddToTeam(),
      title: 'Add to team...',
    },
    {
      onClick: () => this.props.onOpenPrivateFolder(),
      title: 'Open private folder',
    },
    {
      onClick: () => this.props.onBrowsePublicFolder(),
      title: 'Browse public folder',
    },
  ]

  render() {
    return (
      <ClickableBox
        onClick={this.props.toggleShowingMenu}
        style={{backgroundColor: globalColors.white}}
        ref={this.props.setAttachmentRef}
      >
        <Box2 direction="horizontal" fullWidth={true} gap="xsmall">
          <Button onClick={null} type="Secondary" label="..." />
        </Box2>
        <FloatingMenu
          attachTo={this.props.attachmentRef}
          closeOnSelect={true}
          items={this._menuItems}
          onHidden={this.props.toggleShowingMenu}
          visible={this.props.showingMenu}
          position="bottom center"
        />
      </ClickableBox>
    )
  }
}

const DropdownButton = FloatingMenuParentHOC(_DropdownButton)

export default UserActions
