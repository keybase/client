import * as React from 'react'
import type * as Types from '../../../../../constants/types/teams'
import * as Kb from '../../../../../common-adapters'
import {FloatingRolePicker} from '../../../../role-picker'
import * as Styles from '../../../../../styles'
import {isLargeScreen} from '../../../../../constants/platform'
import {formatTimeRelativeToNow} from '../../../../../util/timestamp'
import MenuHeader from '../../menu-header.new'

export type RowProps = {
  ctime: number
  disabledReasonsForRolePicker: Types.DisabledReasonsForRolePicker
  firstItem: boolean
  fullName: string
  onChat: () => void
  onIgnoreRequest: () => void
  onOpenProfile: (u: string) => void
  teamID: Types.TeamID
  username: string
  reset?: boolean
  waiting: boolean
}

type RolePickerProps = {
  onAccept: () => void
  isRolePickerOpen: boolean
  onCancelRolePicker: () => void
  onConfirmRolePicker: (role: Types.TeamRoleType) => void
  onEditMembership: () => void
  footerComponent: React.ReactNode
}

export type Props = {} & RowProps & RolePickerProps

export const TeamRequestRow = (props: Props) => {
  const {ctime, fullName, username, onAccept, onOpenProfile, reset} = props

  const approveWord = reset ? 'Readmit' : 'Approve'
  const denyWord = reset ? 'Remove' : 'Deny'

  const {showingPopup, setShowingPopup, toggleShowingPopup, popup, popupAnchor} = Kb.usePopup(attachTo => (
    <Kb.FloatingMenu
      header={
        <MenuHeader
          username={username}
          fullName={fullName ? fullName : undefined}
          label={reset ? 'Reset their account' : `Requested to join ${formatTimeRelativeToNow(ctime * 1000)}`}
        />
      }
      items={[
        'Divider',
        {icon: 'iconfont-chat', onClick: props.onChat, title: 'Chat'},
        {icon: 'iconfont-check', onClick: props.onAccept, title: approveWord},
        {
          danger: true,
          icon: 'iconfont-block',
          onClick: props.onIgnoreRequest,
          subTitle: `They won't be notified`,
          title: denyWord,
        },
      ]}
      visible={showingPopup}
      onHidden={() => setShowingPopup(false)}
      closeOnSelect={true}
      attachTo={attachTo}
      position="bottom left"
      positionFallbacks={['left center' as const, 'top left' as const]}
    />
  ))

  return (
    <Kb.ListItem2
      type="Small"
      icon={<Kb.Avatar username={username} size={32} />}
      body={
        <Kb.Box2 direction="horizontal" fullHeight={true} alignItems="center">
          <Kb.Box2 direction="vertical" fullWidth={true}>
            <Kb.ConnectedUsernames type="BodyBold" colorFollowing={true} usernames={username} />
            <Kb.Box2 direction="horizontal" alignSelf="flex-start">
              <Kb.Meta
                title={reset ? 'locked out' : 'please decide'}
                style={styleCharm}
                backgroundColor={reset ? Styles.globalColors.red : Styles.globalColors.orange}
              />
              {Styles.isMobile ? (
                isLargeScreen && (
                  <Kb.Text type="BodySmall" ellipsizeMode="tail" lineClamp={1} style={styles.newFullName}>
                    {fullName !== '' && `${fullName}`}
                  </Kb.Text>
                )
              ) : (
                <Kb.Text type="BodySmall" lineClamp={1}>
                  {fullName !== '' && `${fullName}  • `}
                  {reset
                    ? fullName
                      ? 'Reset their account'
                      : 'reset their account'
                    : formatTimeRelativeToNow(ctime * 1000)}
                </Kb.Text>
              )}
            </Kb.Box2>
          </Kb.Box2>
        </Kb.Box2>
      }
      action={
        <Kb.Box2 direction="horizontal">
          <FloatingRolePicker
            floatingContainerStyle={styles.floatingRolePicker}
            footerComponent={props.footerComponent}
            onConfirm={props.onConfirmRolePicker}
            onCancel={props.onCancelRolePicker}
            position="bottom left"
            open={props.isRolePickerOpen}
            disabledRoles={props.disabledReasonsForRolePicker}
          >
            <Kb.Button
              label={approveWord}
              onClick={onAccept}
              small={true}
              style={styles.letInButton}
              waiting={props.waiting}
            />
          </FloatingRolePicker>
          <Kb.Button
            mode="Secondary"
            type="Dim"
            small={true}
            icon="iconfont-ellipsis"
            style={styles.ignoreButton}
            onClick={toggleShowingPopup}
            ref={popupAnchor}
          />
          {popup}
        </Kb.Box2>
      }
      onClick={props.isRolePickerOpen ? undefined : () => onOpenProfile(username)}
      firstItem={props.firstItem}
      style={props.waiting ? styles.disabled : styles.bg}
    />
  )
}

const styleCharm = {
  alignSelf: 'center',
  marginRight: Styles.globalMargins.xtiny,
} as const

const styles = Styles.styleSheetCreate(() => ({
  bg: {backgroundColor: Styles.globalColors.white},
  clickContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      flexGrow: 0,
      flexShrink: 1,
    },
    isElectron: {width: 'initial'},
  }),
  container: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small),
      alignItems: 'center',
      flexDirection: 'row',
      flexGrow: 0,
      flexShrink: 1,
      height: 48,
      justifyContent: 'space-between',
      width: '100%',
    },
    isPhone: {
      flexDirection: 'column',
      height: 112,
    },
    isTablet: {height: 56},
  }),
  disabled: {backgroundColor: Styles.globalColors.white, opacity: 0.4},
  floatingRolePicker: Styles.platformStyles({
    isElectron: {
      position: 'relative',
      top: -32,
    },
  }),
  floatingRolePickerContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      marginTop: 0,
    },
    isMobile: {marginTop: Styles.globalMargins.tiny},
  }),
  icon: {
    marginLeft: Styles.globalMargins.small,
    marginRight: Styles.globalMargins.tiny,
  },
  ignoreButton: {marginLeft: Styles.globalMargins.xtiny},
  letInButton: {
    backgroundColor: Styles.globalColors.green,
    marginLeft: Styles.globalMargins.xtiny,
  },
  newFullName: {
    ...Styles.globalStyles.flexOne,
    paddingRight: Styles.globalMargins.xtiny,
  },
  userDetails: {
    ...Styles.globalStyles.flexBoxColumn,
    flexGrow: 1,
    marginLeft: Styles.globalMargins.small,
  },
}))
