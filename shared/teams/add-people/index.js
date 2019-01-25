// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import UserInput from '../../search/user-input/container'
import SearchResultsList from '../../search/results-list/container'
import {type TeamRoleType} from '../../constants/types/teams'

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

type Props = {
  addButtonLabel: string,
  errorText: string,
  numberOfUsersSelected: number,
  loading: boolean,
  onAddPeople: () => void,
  onClearSearch: () => void,
  onClose: () => void,
  onLeave: () => void,
  onOpenRolePicker: () => void,
  onRoleChange: (role: TeamRoleType) => void,
  name: string,
  role: TeamRoleType,
  showSearchPending: boolean,
  sendNotification: boolean,
  setSendNotification: (sendNotification: boolean) => void,
  title: string,
}

const AddPeople = (props: Props) => (
  <MaybePopup onClose={props.onClose}>
    <Kb.Box style={styles.outerBox}>
      <Kb.HeaderHocHeader
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
                backgroundMode="HighRisk"
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
        {props.showSearchPending ? (
          <Kb.ProgressIndicator style={{width: 24}} />
        ) : (
          <SearchResultsList
            searchKey={'addToTeamSearch'}
            disableIfInTeamName={props.name}
            style={
              Styles.isMobile ? {bottom: 0, left: 0, position: 'absolute', right: 0, top: 0} : {height: 300}
            }
            keyboardDismissMode="on-drag"
          />
        )}
      </Kb.Box>
      {!Styles.isMobile && (
        <Kb.Box style={{...Styles.globalStyles.flexBoxColumn, padding: Styles.globalMargins.medium}}>
          <Kb.Box style={{...Styles.globalStyles.flexBoxRow, justifyContent: 'center'}}>
            <Kb.WaitingButton
              disabled={!props.numberOfUsersSelected}
              onClick={props.onOpenRolePicker}
              label={props.addButtonLabel}
              waitingKey={null}
              type="Primary"
            />
          </Kb.Box>
        </Kb.Box>
      )}
    </Kb.Box>
  </MaybePopup>
)

const styles = Styles.styleSheetCreate({
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
    backgroundColor: Styles.globalColors.black_75,
  },
})

export default AddPeople
