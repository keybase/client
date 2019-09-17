import * as React from 'react'
import openURL from '../../util/open-url'
import {Avatar, Box, Button, Icon, Text, HeaderHoc} from '../../common-adapters'
import {capitalize} from 'lodash-es'
import * as Styles from '../../styles'
import {platformToLogo24} from '../../constants/search'
import {Props} from '.'

const NonUserRender = (props: Props) => (
  <Box style={styles.container}>
    <Box style={styles.header} />
    <Box style={styles.bioBlurb}>
      <Avatar onClick={() => openURL(props.profileUrl)} size={128} />
      <Box style={styles.usernameRow} onClick={() => openURL(props.profileUrl)}>
        <Icon type={platformToLogo24(props.serviceName)} />
        <Text type="HeaderBig" selectable={true} style={styles.username}>
          {props.username}
        </Text>
      </Box>
      {props.fullname && (
        <Text type="BodySemibold" selectable={true} style={styles.fullname}>
          {props.fullname}
        </Text>
      )}
      <Text type="BodySmall" style={styles.serviceLabel}>
        {capitalize(props.serviceName)} user
      </Text>
    </Box>
    <Button
      style={{marginTop: Styles.globalMargins.medium}}
      onClick={props.onStartChat}
      label="Start a chat"
    />
    <Text center={true} type="BodySmall" style={styles.details}>{`When ${
      props.username
    } connects Keybase and their ${capitalize(
      props.serviceName
    )} account, your computer will verify them and rekey the folder or conversation.`}</Text>
  </Box>
)

const styles = Styles.styleSheetCreate(() => ({
  bioBlurb: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: Styles.globalMargins.medium,
  },
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    position: 'relative',
  },
  details: {
    marginLeft: Styles.globalMargins.medium,
    marginRight: Styles.globalMargins.medium,
    marginTop: Styles.globalMargins.medium,
  },
  fullname: {
    color: Styles.globalColors.black,
    marginTop: 2,
  },
  header: {
    backgroundColor: Styles.globalColors.blue,
    position: 'absolute',
    width: '100%',
  },
  serviceLabel: Styles.platformStyles({
    common: {
      fontSize: 14,
      lineHeight: 19,
      marginTop: Styles.globalMargins.xtiny,
    },
  }),
  username: {
    marginLeft: Styles.globalMargins.xtiny,
  },
  usernameRow: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    marginTop: Styles.globalMargins.tiny,
  },
}))

export default HeaderHoc(NonUserRender)
