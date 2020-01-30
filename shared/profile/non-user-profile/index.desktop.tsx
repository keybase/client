import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {serviceIdToLogo24} from '../../util/platforms'
import {AVATAR_SIZE} from '../../constants/profile'
import {Props} from '.'
import {serviceIdToPrettyName} from '../../constants/team-building'

const HEADER_TOP_SPACE = 48
const HEADER_SIZE = AVATAR_SIZE / 2 + HEADER_TOP_SPACE

const NonUserRender = (props: Props) => (
  <Kb.Box style={styles.container}>
    <Kb.Box style={styles.header} />
    <Kb.Box style={Styles.globalStyles.flexBoxColumn}>
      <Kb.BackButton
        onClick={props.onBack}
        style={{left: 14, position: 'absolute', top: 16, zIndex: 12}}
        textStyle={{color: Styles.globalColors.white}}
        iconColor={Styles.globalColors.white}
      />
    </Kb.Box>
    <Kb.Box style={Styles.globalStyles.flexBoxRow}>
      <Kb.Box style={styles.leftColumn}>
        <Kb.Box style={styles.bioBlurb}>
          <Kb.Avatar size={AVATAR_SIZE} />
          <Kb.Box style={styles.usernameRow}>
            <Kb.Icon type={Kb.Icon.makeFastType(serviceIdToLogo24(props.serviceId))} />
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
          <Kb.Button
            style={{marginTop: Styles.globalMargins.medium}}
            onClick={props.onStartChat}
            label="Start a chat"
          />
          <Kb.Button
            style={{marginTop: Styles.globalMargins.tiny}}
            onClick={props.onOpenPrivateFolder}
            label="Open private folder"
            type="Dim"
          />
        </Kb.Box>
      </Kb.Box>
      <Kb.Box style={styles.rightColumn}>
        <Kb.Text center={true} type="BodySmall" style={styles.details}>{`When ${
          props.username
        } connects Keybase and their ${serviceIdToPrettyName(
          props.serviceId
        )} account, your computer will verify them and rekey the folder or conversation.`}</Kb.Text>
      </Kb.Box>
    </Kb.Box>
  </Kb.Box>
)

const styles = Styles.styleSheetCreate(() => ({
  bioBlurb: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 48,
  },
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    height: '100%',
    position: 'relative',
  },
  details: {
    marginLeft: Styles.globalMargins.medium,
    marginRight: Styles.globalMargins.medium,
    marginTop: Styles.globalMargins.large,
  },
  fullname: {
    color: Styles.globalColors.black,
    marginTop: 2,
  },
  header: {
    backgroundColor: Styles.globalColors.blue,
    height: HEADER_SIZE,
    position: 'absolute',
    width: '100%',
  },
  leftColumn: {
    ...Styles.globalStyles.flexBoxColumn,
    paddingLeft: Styles.globalMargins.medium,
    paddingRight: Styles.globalMargins.medium,
    width: '50%',
  },
  rightColumn: {
    ...Styles.globalStyles.flexBoxColumn,
    marginTop: 130,
    paddingLeft: Styles.globalMargins.medium,
    paddingRight: Styles.globalMargins.medium,
    width: 320,
  },
  serviceLabel: Styles.platformStyles({
    common: {
      fontSize: 12,
      lineHeight: 16,
      marginTop: Styles.globalMargins.xtiny,
    },
    isElectron: {
      textTransform: 'uppercase',
    },
  }),
  username: {
    marginLeft: Styles.globalMargins.xtiny,
  },
  usernameRow: Styles.platformStyles({
    isElectron: {
      ...Styles.globalStyles.flexBoxRow,
      ...Styles.desktopStyles.clickable,
      alignItems: 'center',
      marginTop: Styles.globalMargins.tiny,
    },
  }),
}))

export default NonUserRender
