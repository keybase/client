import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import openURL from '../../util/open-url'
import {serviceIdToLogo24} from '../../util/platforms'
import {Props} from '.'
import {serviceIdToPrettyName} from '../../constants/team-building'

const NonUserRender = (props: Props) => (
  <Kb.HeaderHocWrapper title={props.title} onBack={props.onBack}>
    <Kb.Box style={styles.container}>
      <Kb.Box style={styles.header} />
      <Kb.Box style={styles.bioBlurb}>
        <Kb.Avatar onClick={() => openURL(props.profileUrl)} size={128} />
        <Kb.Box style={styles.usernameRow} onClick={() => openURL(props.profileUrl)}>
          <Kb.Icon type={serviceIdToLogo24(props.serviceId)} />
          <Kb.Text type="HeaderBig" selectable={true} style={styles.username}>
            {props.username}
          </Kb.Text>
        </Kb.Box>
        {props.fullname && (
          <Kb.Text type="BodySemibold" selectable={true} style={styles.fullname}>
            {props.fullname}
          </Kb.Text>
        )}
        <Kb.Text type="BodySmall" style={styles.serviceLabel}>
          {serviceIdToPrettyName(props.serviceId)} user
        </Kb.Text>
      </Kb.Box>
      <Kb.Button
        style={{marginTop: Styles.globalMargins.medium}}
        onClick={props.onStartChat}
        label="Start a chat"
      />
      <Kb.Text center={true} type="BodySmall" style={styles.details}>{`When ${
        props.username
      } connects Keybase and their ${serviceIdToPrettyName(
        props.serviceId
      )} account, your computer will verify them and rekey the folder or conversation.`}</Kb.Text>
    </Kb.Box>
  </Kb.HeaderHocWrapper>
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

export default NonUserRender
