// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import UserInput from '../../search/user-input/container'
import SearchResultsList from '../../search/results-list/container'
import * as Constants from '../../constants/teams'
import {type TeamRoleType, type DisabledReasonsForRolePicker} from '../../constants/types/teams'
import {FloatingRolePicker} from '../role-picker'
import flags from '../../util/feature-flags'

const MaybePopup = Styles.isMobile
  ? (props: {onClose: () => void, children: React.Node}) => (
      <Kb.Box style={{flexGrow: 1, width: '100%'}} children={props.children} />
    )
  : (props: {onClose: () => void, children: React.Node}) => (
      <Kb.PopupDialog
        onClose={props.onClose}
        styleCover={styles.popupCover}
        styleContainer={styles.popupContainer}
        children={props.children}
      />
    )

export type AddPeopleProps = {|
  addButtonLabel: string,
  disabledReasonsForRolePicker: DisabledReasonsForRolePicker,
  errorText: string,
  numberOfUsersSelected: number,
  onClearSearch: () => void,
  onClose: () => void,
  name: string,
  title: string,
|}

type RolePickerProps = {|
  confirmLabel?: string,
  footerComponent: React.Node,
  isRolePickerOpen: boolean,
  onCancelRolePicker: () => void,
  onConfirmRolePicker: (role: TeamRoleType) => void,
  onEditMembership: () => void,
  onOpenRolePicker: () => void,
  onSelectRole: (role: TeamRoleType) => void,
  selectedRole: ?TeamRoleType,
|}

type Props = {|
  ...AddPeopleProps,
  ...RolePickerProps,
|}

const AddPeople = (props: Props) => (
  <MaybePopup onClose={props.onClose}>
    <Kb.Box style={styles.outerBox}>
      <Kb.HeaderHocHeader
        headerStyle={styles.header}
        onCancel={Styles.isMobile ? props.onClose : null}
        onRightAction={props.numberOfUsersSelected > 0 ? props.onOpenRolePicker : null}
        rightActionLabel={props.addButtonLabel}
        title={props.title}
      />
      {!!props.errorText && (
        <Kb.Box
          style={Styles.collapseStyles([
            Styles.globalStyles.flexBoxColumn,
            {backgroundColor: Styles.globalColors.red},
          ])}
        >
          {props.errorText.split('\n').map(line => (
            <Kb.Box key={line} style={Styles.globalStyles.flexBoxRow}>
              <Kb.Text
                center={true}
                style={{margin: Styles.globalMargins.tiny, width: '100%'}}
                type="BodySemibold"
                negative={true}
              >
                {line}
              </Kb.Text>
            </Kb.Box>
          ))}
        </Kb.Box>
      )}

      <Kb.Box style={Styles.globalStyles.flexBoxColumn}>
        <UserInput
          autoFocus={true}
          hideAddButton={true}
          onExitSearch={props.onClearSearch}
          placeholder="Add people"
          searchKey={'addToTeamSearch'}
          showServiceFilter={true}
        />
      </Kb.Box>
      <Kb.Box style={{...Styles.desktopStyles.scrollable, flex: 1}}>
        <SearchResultsList
          searchKey={'addToTeamSearch'}
          disableIfInTeamName={props.name}
          style={
            Styles.isMobile ? {bottom: 0, left: 0, position: 'absolute', right: 0, top: 0} : {height: 300}
          }
          keyboardDismissMode="on-drag"
        />
      </Kb.Box>
      {!Styles.isMobile && (
        <Kb.Box style={{...Styles.globalStyles.flexBoxColumn, padding: Styles.globalMargins.medium}}>
          <Kb.Box style={{...Styles.globalStyles.flexBoxRow, justifyContent: 'center'}}>
            <FloatingRolePicker
              confirmLabel={props.confirmLabel}
              selectedRole={props.selectedRole}
              onSelectRole={props.onSelectRole}
              floatingContainerStyle={styles.floatingRolePicker}
              footerComponent={props.footerComponent}
              onConfirm={props.onConfirmRolePicker}
              onCancel={props.onCancelRolePicker}
              position={'top center'}
              open={props.isRolePickerOpen}
              disabledRoles={props.disabledReasonsForRolePicker}
            >
              <Kb.WaitingButton
                disabled={!props.numberOfUsersSelected}
                onClick={props.onOpenRolePicker}
                label={props.addButtonLabel}
                waitingKey={Constants.addPeopleToTeamWaitingKey(props.name)}
              />
            </FloatingRolePicker>
          </Kb.Box>
        </Kb.Box>
      )}
    </Kb.Box>
  </MaybePopup>
)

const styles = Styles.styleSheetCreate({
  floatingRolePicker: Styles.platformStyles({
    isElectron: {
      bottom: -32,
      position: 'relative',
    },
  }),
  header: flags.useNewRouter ? {minHeight: 48} : {},
  outerBox: Styles.platformStyles({
    isElectron: {
      ...Styles.globalStyles.flexBoxColumn,
      marginTop: Styles.globalMargins.xxtiny,
    },
    isMobile: {
      flexGrow: 1,
    },
  }),
  popupContainer: Styles.platformStyles({
    common: {
      alignSelf: 'center',
    },
    isElectron: {
      ...Styles.desktopStyles.boxShadow,
      borderRadius: 4,
      height: 520,
      margin: 40,
      width: 620,
    },
  }),
  popupCover: {
    backgroundColor: Styles.globalColors.black,
  },
})

export default AddPeople
