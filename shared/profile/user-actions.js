// @flow
import * as React from 'react'
import {Box2, Button, ClickableBox, FloatingMenu, FollowButton, ButtonBar, Icon} from '../common-adapters'
import {FloatingMenuParentHOC, type FloatingMenuParentProps} from '../common-adapters/floating-menu'
import {normal as proofNormal} from '../constants/tracker'
import {globalColors, isMobile, platformStyles, styleSheetCreate} from '../styles'
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
  onRefresh: () => void,
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
  onRefresh,
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
          />
        </ButtonBar>
      )
    } else {
      return (
        <ButtonBar style={style}>
          <Button type="Secondary" label="Refresh" onClick={onRefresh} />
          <Button type="PrimaryGreen" label="Accept" onClick={onAcceptProofs} />
          <DropdownButton
            onAddToTeam={onAddToTeam}
            onOpenPrivateFolder={onOpenPrivateFolder}
            onBrowsePublicFolder={onBrowsePublicFolder}
            onUnfollow={onUnfollow}
          />
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
  onUnfollow?: () => void,
}

class _DropdownButton extends React.PureComponent<DropdownProps & FloatingMenuParentProps> {
  _menuItems = [
    {
      onClick: () => this.props.onAddToTeam(),
      title: 'Add to team...',
    },
  ]

  componentDidMount() {
    if (!isMobile) {
      this._menuItems = this._menuItems.concat([
        {
          onClick: () => this.props.onOpenPrivateFolder(),
          title: 'Open private folder',
        },
        {
          onClick: () => this.props.onBrowsePublicFolder(),
          title: 'Browse public folder',
        },
      ])
    }

    this.props.onUnfollow &&
      this._menuItems.push({
        onClick: () => this.props.onUnfollow && this.props.onUnfollow(),
        style: {
          borderTopWidth: 0,
        },
        title: 'Unfollow',
      })
  }

  render() {
    return (
      <ClickableBox
        onClick={this.props.toggleShowingMenu}
        style={{backgroundColor: globalColors.white}}
        ref={this.props.setAttachmentRef}
      >
        <Box2 direction="horizontal" fullWidth={true} gap="xsmall">
          <Button onClick={null} type="Secondary" style={iconButton}>
            <Icon
              color={globalColors.black_75}
              fontSize={isMobile ? 21 : 16}
              style={ellipsisIcon}
              type="iconfont-ellipsis"
            />
          </Button>
        </Box2>
        <FloatingMenu
          attachTo={this.props.attachmentRef}
          closeOnSelect={true}
          containerStyle={styles.floatingMenu}
          items={this._menuItems}
          onHidden={this.props.toggleShowingMenu}
          position="bottom right"
          visible={this.props.showingMenu}
        />
      </ClickableBox>
    )
  }
}

const ellipsisIcon = platformStyles({
  common: {
    position: 'relative',
    top: 1,
  },
})

const iconButton = platformStyles({
  isElectron: {
    paddingLeft: 16,
    paddingRight: 16,
  },
  isMobile: {
    paddingLeft: 12,
    paddingRight: 12,
  },
})

const styles = styleSheetCreate({
  floatingMenu: {
    marginTop: 4,
  },
})

const DropdownButton = FloatingMenuParentHOC(_DropdownButton)

export default UserActions
