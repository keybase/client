// @flow
import React from 'react'
import {Avatar, Box2, ClickableBox, HeaderOnMobile, Icon, MaybePopup, Text} from '../../../common-adapters'
import {globalColors, globalMargins, globalStyles, platformStyles, styleSheetCreate} from '../../../styles'

export type Props = {
  name: string,
  user: string,
  type: 'default' | 'secondary',
  currency: string,
  onDelete: () => void,
  onSetDefault: () => void,
  onEditName: () => void,
}

const SettingsPopup = (props: Props) => (
  <MaybePopup onClose={() => {}}>
    <Box2
      direction="vertical"
      style={{
        ...stylePadding,
        backgroundColor: globalColors.white,
        padding: globalMargins.small,
        maxWidth: 560,
      }}
    >
      <Box2 centerChildren={true} direction="vertical">
        <Text style={{padding: globalMargins.small}} type="Header">
          Settings
        </Text>
      </Box2>
      <Text type="BodySmallSemibold">Account name</Text>
      <ClickableBox style={styles.nameBox}>
        <Text type="BodySemibold">{props.name}</Text>
        <Icon style={{marginLeft: globalMargins.xtiny}} type="iconfont-edit" onClick={props.onEditName} />
      </ClickableBox>
      <Text type="BodySmallSemibold">Identity</Text>
      <Box2 direction="horizontal" fullWidth={true} style={{marginBottom: globalMargins.medium}}>
        <Avatar size={32} style={styles.avatar} username={props.type === 'default' ? props.user : ''} />
        <Box2 direction="vertical">
          <Text type="Header">
            {props.type === 'default'
              ? 'This is your default Keybase account.'
              : 'This is a secondary account.'}
          </Text>
          <Text type="BodySmall">
            {props.type === 'default'
              ? 'All transactions and overall activity are tied to your Keybase identity.'
              : 'Transactions will be tied to your Stellar public address only.'}
          </Text>
          {props.type === 'secondary' && (
            <Text type="BodySmallPrimaryLink" onClick={props.onSetDefault}>
              Set as default Keybase account
            </Text>
          )}
        </Box2>
      </Box2>
      <Text type="BodySmallSemibold">Display currency</Text>
      <ClickableBox
        style={{
          ...globalStyles.flexBoxRow,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={props.onDelete}
      >
        <Icon type="iconfont-trash" style={{marginRight: globalMargins.tiny}} color={globalColors.red} />
        <Text type="BodySemibold" style={{color: globalColors.red}} className="hover-underline">
          Remove account
        </Text>
      </ClickableBox>
    </Box2>
  </MaybePopup>
)

const stylePadding = platformStyles({
  isMobile: {
    paddingTop: globalMargins.xlarge,
  },
  isElectron: {
    marginBottom: 40,
    marginLeft: 80,
    marginRight: 80,
    marginTop: 40,
  },
})

const styles = styleSheetCreate({
  avatar: {marginRight: globalMargins.xtiny},
  nameBox: {
    ...globalStyles.flexBoxRow,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    marginBottom: globalMargins.medium,
  },
})

export default HeaderOnMobile(SettingsPopup)
