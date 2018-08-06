// @flow
import * as React from 'react'
import {Avatar, Box, Box2, ClickableBox, ConnectedUsernames, Icon, iconCastPlatformStyles, NameWithIcon, NewInput, Text} from '../../../common-adapters'
import {collapseStyles, isMobile, globalColors, globalMargins, platformStyles, styleSheetCreate} from '../../../styles'

type Props = {
  onChangeAddress?: string => void,
  incorrect?: boolean,
  username?: string,
  fullname?: string,
  onShowProfile?: string => void,
}

const Participants = (props: Props) => (
  <Box2 direction="vertical">
    <Box2 direction="horizontal" style={styles.container} fullWidth={true}>
      <Text type="BodySmall" style={styles.text}>
        To:
      </Text>
    {!!props.username && (
      <NameWithIcon colorFollowing={true} horizontal={true} username={props.username} metaOne={props.fullname} onClick={props.onSHowProfile}/>
    )}
    {!props.username && (
      <Box2 direction="vertical" fullWidh={true} style={{flexGrow: 1}}>
        <Box2 direction="horizontal" fullWidth={true}>
          <Icon
            type={props.incorrect ? 'iconfont-stellar-request' : 'iconfont-stellar-request'}
            style={iconCastPlatformStyles(styles.icon)}
          />
          <NewInput
            type="text"
            onChangeText={props.onChangeAddress}
            textType="BodySemibold"
            placeholder="Stellar address"
            placeholderColor={globalColors.grey}
            hideBorder={true}
            style={styles.input}
            multiline={true}
          />
        </Box2>
        {props.incorrect && (
            <Text type="BodySmall" style={styles.error}>
              This Stellar address is incorrect
            </Text>
        )}
      </Box2>
    )}
    </Box2>
    {props.incorrect && (
      <Box style={styles.redline} />
    )}
  </Box2>
)

const styles = styleSheetCreate({
  avatarName: {
    flexDirection: 'row',
  },
  text: {
    color: globalColors.blue,
    marginRight: globalMargins.xsmall,
    marginTop: globalMargins.xtiny,
    alignSelf: 'flex-start',
  },
  container: {
    margin: globalMargins.xsmall,
    alignItems: 'flex-start',
  },
  error: platformStyles({
    common: {
      color: globalColors.red,
      width: '100%',
    },
    isElectron: {
      wordWrap: 'break-word',
    },
  }),
  icon: {},
  input: {},
  redline: {
    backgroundColor: globalColors.red,
    height: 1,
    width: '100%'
  },
})

export default Participants
