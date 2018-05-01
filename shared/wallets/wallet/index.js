// @flow
import * as React from 'react'
import {Box2, ClickableBox, Icon, Text, Avatar, FloatingMenu} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins, isMobile} from '../../styles'
import {FloatingMenuParentHOC, type FloatingMenuParentProps} from '../../common-adapters/floating-menu'

type Props = {
  isSelected: boolean,
  name: string,
  keybaseUser: string,
  contents: string,
  onSelect: () => void,
}

class Wallet extends React.PureComponent<Props> {
  render() {
    const color = this.props.isSelected ? globalColors.blue : globalColors.white

    const titleStyle = {
      ...globalStyles.fontSemibold,
      color: this.props.isSelected ? globalColors.white : globalColors.darkBlue,
      backgroundColor: color,
      fontSize: 13,
      marginLeft: this.props.keybaseUser ? globalMargins.xtiny : 0,
    }
    const amountStyle = {
      color: this.props.isSelected ? globalColors.white : globalColors.black_40,
      backgroundColor: color,
      fontSize: 11,
    }
    const props = this.props
    return (
      <ClickableBox onClick={props.onSelect} style={{backgroundColor: color}}>
        <Box2 style={{height: rowHeight, backgroundColor: color}} direction="horizontal">
          <Box2 direction="horizontal">
            <Icon type={'iconfont-hand-wave'} color={globalColors.darkBlue} fontSize={28} />
          </Box2>
          <Box2 direction="vertical" fullWidth={true}>
            <Box2 direction="horizontal">
              {this.props.keybaseUser && <Avatar size={16} username={this.props.keybaseUser} />}
              <Text type="BodySmall" style={titleStyle}>
                {props.name}
              </Text>
            </Box2>
            <Text type="BodySmall" style={amountStyle}>
              {props.contents}
            </Text>
          </Box2>
        </Box2>
      </ClickableBox>
    )
  }
}

type AddProps = {
  onAddNew: () => void,
  onLinkExisting: () => void,
}

class _AddWallet extends React.PureComponent<AddProps & FloatingMenuParentProps> {
  _menuItems = [
    {
      onClick: () => this.props.onAddNew(),
      title: 'Create a new wallet',
    },
    {
      disabled: isMobile,
      onClick: () => this.props.onLinkExisting(),
      title: 'Link an existing Stellar wallet',
    },
  ]

  render() {
    return (
      <ClickableBox
        onClick={this.props.toggleShowingMenu}
        style={{backgroundColor: globalColors.white}}
        ref={this.props.setAttachmentRef}
      >
        <Box2 style={{height: rowHeight, alignItems: 'center'}} direction="horizontal">
          <Icon
            type="iconfont-new"
            color={globalColors.blue}
            style={{marginLeft: globalMargins.small, marginRight: globalMargins.xtiny}}
          />
          <Text type="BodyBigLink" style={{padding: globalMargins.xtiny}}>
            Add a wallet
          </Text>
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

const AddWallet = FloatingMenuParentHOC(_AddWallet)

const rowHeight = isMobile ? 64 : 56

export {Wallet, AddWallet}
