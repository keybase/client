import * as React from 'react'
import * as C from '@/constants'
import type * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import {FloatingRolePicker} from '@/teams/role-picker'
import {formatTimeRelativeToNow} from '@/util/timestamp'
import MenuHeader from '../../menu-header.new'

const positionFallbacks = ['left center', 'top left'] as const

export type RowProps = {
  ctime: number
  disabledReasonsForRolePicker: T.Teams.DisabledReasonsForRolePicker
  firstItem: boolean
  fullName: string
  onChat: () => void
  onIgnoreRequest: () => void
  onOpenProfile: (u: string) => void
  teamID: T.Teams.TeamID
  username: string
  reset?: boolean
  waiting: boolean
}

type RolePickerProps = {
  onAccept: () => void
  isRolePickerOpen: boolean
  onCancelRolePicker: () => void
  onConfirmRolePicker: (role: T.Teams.TeamRoleType) => void
  onEditMembership: () => void
  footerComponent: React.ReactNode
}

export type Props = {} & RowProps & RolePickerProps

export const TeamRequestRow = (props: Props) => {
  const {ctime, fullName, username, onAccept, onOpenProfile, reset} = props

  const approveWord = reset ? 'Readmit' : 'Approve'
  const denyWord = reset ? 'Remove' : 'Deny'

  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, hidePopup} = p
      return (
        <Kb.FloatingMenu
          header={
            <MenuHeader
              username={username}
              fullName={fullName ? fullName : undefined}
              label={
                reset ? 'Reset their account' : `Requested to join ${formatTimeRelativeToNow(ctime * 1000)}`
              }
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
          visible={true}
          onHidden={hidePopup}
          closeOnSelect={true}
          attachTo={attachTo}
          position="bottom left"
          positionFallbacks={positionFallbacks}
        />
      )
    },
    [approveWord, ctime, denyWord, fullName, props, reset, username]
  )
  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

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
                backgroundColor={reset ? Kb.Styles.globalColors.red : Kb.Styles.globalColors.orange}
              />
              {Kb.Styles.isMobile ? (
                C.isLargeScreen && (
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
            onClick={showPopup}
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
  marginRight: Kb.Styles.globalMargins.xtiny,
} as const

const styles = Kb.Styles.styleSheetCreate(() => ({
  bg: {backgroundColor: Kb.Styles.globalColors.white},
  clickContainer: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      flexGrow: 0,
      flexShrink: 1,
    },
    isElectron: {width: 'initial'},
  }),
  container: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.globalStyles.flexBoxRow,
      ...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.small),
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
  disabled: {backgroundColor: Kb.Styles.globalColors.white, opacity: 0.4},
  floatingRolePicker: Kb.Styles.platformStyles({
    isElectron: {
      position: 'relative',
      top: -32,
    },
  }),
  floatingRolePickerContainer: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      marginTop: 0,
    },
    isMobile: {marginTop: Kb.Styles.globalMargins.tiny},
  }),
  icon: {
    marginLeft: Kb.Styles.globalMargins.small,
    marginRight: Kb.Styles.globalMargins.tiny,
  },
  ignoreButton: {marginLeft: Kb.Styles.globalMargins.xtiny},
  letInButton: {
    backgroundColor: Kb.Styles.globalColors.green,
    marginLeft: Kb.Styles.globalMargins.xtiny,
  },
  newFullName: {
    ...Kb.Styles.globalStyles.flexOne,
    paddingRight: Kb.Styles.globalMargins.xtiny,
  },
  userDetails: {
    ...Kb.Styles.globalStyles.flexBoxColumn,
    flexGrow: 1,
    marginLeft: Kb.Styles.globalMargins.small,
  },
}))
