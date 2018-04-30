// @flow
import * as React from 'react'
import {Box, ClickableBox, Icon, Text, Avatar, FloatingMenu} from '../../common-adapters'
import {glamorous, globalStyles, globalColors, globalMargins, isMobile, desktopStyles} from '../../styles'
import {FloatingMenuParentHOC, type FloatingMenuParentProps} from '../../common-adapters/floating-menu'

type Props = {
  isSelected: boolean,
  name: string,
  keybaseUser: string,
  contents: string,
  onSelect: () => void,
}

const WalletBox = isMobile
  ? Box
  : glamorous(Box)({
      '& .small-team-gear': {display: 'none'},
      ':hover .small-team-gear': {display: 'unset'},
      ':hover .small-team-timestamp': {display: 'none'},
    })

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
        <WalletBox style={{...rowContainerStyle, backgroundColor: color}}>
          <Box style={iconBoxStyle}>
            <Icon type={'iconfont-hand-wave'} color={globalColors.darkBlue} fontSize={28} />
          </Box>
          <Box style={walletRowStyle}>
            <Box style={globalStyles.flexBoxRow}>
              {this.props.keybaseUser && <Avatar size={16} username={this.props.keybaseUser} />}
              <Text type="BodySmall" style={titleStyle}>
                {props.name}
              </Text>
            </Box>
            <Text type="BodySmall" style={amountStyle}>
              {props.contents}
            </Text>
          </Box>
        </WalletBox>
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
        <Box style={{...rowContainerStyle, alignItems: 'center'}}>
          <Icon
            type="iconfont-new"
            color={globalColors.blue}
            style={{marginLeft: globalMargins.small, marginRight: globalMargins.xtiny}}
          />
          <Text type="BodyBigLink" style={{padding: globalMargins.xtiny}}>
            Add a wallet
          </Text>
        </Box>
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

const walletRowStyle = {
  ...globalStyles.flexBoxColumn,
  flexGrow: 1,
  height: '100%',
  justifyContent: 'center',
  paddingLeft: 8,
  paddingRight: 8,
}

const rowHeight = isMobile ? 64 : 56

const rowContainerStyle = {
  ...globalStyles.flexBoxRow,
  ...desktopStyles.clickable,
  flexShrink: 0,
  height: rowHeight,
}

const iconBoxStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  flexShrink: 0,
  justifyContent: 'flex-start',
  marginLeft: globalMargins.tiny,
  marginRight: globalMargins.tiny,
  maxWidth: isMobile ? 48 : 40,
  minWidth: isMobile ? 48 : 40,
  position: 'relative',
  paddingTop: 4,
  paddingBottom: 4,
  paddingLeft: 4,
  height: '100%',
}

export {Wallet, AddWallet}
