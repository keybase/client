import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as TeamTypes from '../../../../constants/types/teams'
import * as TeamConstants from '../../../../constants/teams'
import * as Style from '../../../../styles'
import {upperFirst} from 'lodash-es'

type Props = {
  canSetMinWriterRole: boolean
  isSmallTeam: boolean
  minWriterRole: TeamTypes.TeamRoleType
  onSetNewRole: (newRole: TeamTypes.TeamRoleType) => void
}

type State = {
  saving: boolean
  selected: TeamTypes.TeamRoleType
}

class MinWriterRole extends React.Component<Props, State> {
  state = {saving: false, selected: this.props.minWriterRole}
  _setSaving = (saving: boolean) => this.setState(s => (s.saving === saving ? null : {saving}))
  _setSelected = selected => this.setState(s => (s.selected === selected ? null : {selected}))
  _selectRole = role => {
    if (role !== this.props.minWriterRole) {
      this._setSaving(true)
      this._setSelected(role)
      this.props.onSetNewRole(role)
    }
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (prevProps.minWriterRole !== this.props.minWriterRole) {
      if (this.props.minWriterRole === prevState.selected) {
        // just got value that matches ours. We aren't saving anymore
        this._setSaving(false)
      }
      this._setSelected(this.props.minWriterRole)
    }
  }

  render() {
    // TODO: create these items somewhere else
    const items = TeamConstants.teamRoleTypes.map(role => ({
      onClick: () => this._selectRole(role),
      title: upperFirst(role),
    }))
    return (
      <Kb.Box2
        direction="vertical"
        gap={this.props.canSetMinWriterRole ? 'tiny' : 'xxtiny'}
        fullWidth={true}
        style={styles.container}
      >
        <Kb.Box2 direction="horizontal" fullWidth={true} gap="xtiny">
          <Kb.Text type="BodySmallSemibold">Minimum role to post</Kb.Text>
        </Kb.Box2>
        {this.props.canSetMinWriterRole ? (
          <Dropdown minWriterRole={this.state.selected} items={items} saving={this.state.saving} />
        ) : (
          <Display minWriterRole={this.props.minWriterRole} />
        )}
      </Kb.Box2>
    )
  }
}

type DropdownProps = Kb.OverlayParentProps & {
  minWriterRole: TeamTypes.TeamRoleType
  items: Kb.MenuItems
  saving: boolean
}

const _Dropdown = ({
  getAttachmentRef,
  items,
  minWriterRole,
  saving,
  setAttachmentRef,
  showingMenu,
  toggleShowingMenu,
}: DropdownProps) => (
  <React.Fragment>
    <Kb.ClickableBox
      style={styles.dropdown}
      ref={Style.isMobile ? null : setAttachmentRef}
      onClick={toggleShowingMenu}
      underlayColor={Style.globalColors.white_40}
    >
      <Kb.Box2 direction="horizontal" style={styles.label}>
        <Kb.Text type="BodySemibold">{upperFirst(minWriterRole)}</Kb.Text>
      </Kb.Box2>
      <Kb.Icon type="iconfont-caret-down" inheritColor={true} fontSize={7} sizeType="Tiny" />
    </Kb.ClickableBox>
    <Kb.FloatingMenu
      attachTo={getAttachmentRef}
      closeOnSelect={true}
      visible={showingMenu}
      items={items}
      onHidden={toggleShowingMenu}
      position="top center"
      positionFallbacks={['bottom center']}
    />
    <Kb.SaveIndicator
      saving={saving}
      style={styles.saveIndicator}
      minSavingTimeMs={300}
      savedTimeoutMs={2500}
    />
  </React.Fragment>
)
const Dropdown = Kb.OverlayParentHOC(_Dropdown)

const Display = ({minWriterRole}) => (
  <Kb.Text type="BodySmall">
    You must be at least {'aeiou'.includes(minWriterRole[0]) ? 'an' : 'a'}{' '}
    <Kb.Text type="BodySmallSemibold">“{minWriterRole}”</Kb.Text> to post in this channel.
  </Kb.Text>
)

const styles = Style.styleSheetCreate({
  container: {
    paddingLeft: Style.globalMargins.small,
    paddingRight: Style.globalMargins.small,
  },
  dropdown: Style.platformStyles({
    common: {
      ...Style.globalStyles.flexBoxRow,
      alignItems: 'center',
      borderColor: Style.globalColors.grey,
      borderRadius: Style.borderRadius,
      borderStyle: 'solid',
      borderWidth: 1,
      minWidth: 220,
      paddingRight: Style.globalMargins.small,
    },
    isElectron: {
      marginRight: 45 - 16,
      width: 'auto',
    },
  }),
  label: {
    ...Style.globalStyles.flexBoxCenter,
    minHeight: Style.isMobile ? 40 : 32,
    width: '100%',
  },
  saveIndicator: Style.platformStyles({
    common: {
      ...Style.globalStyles.flexBoxRow,
      alignItems: 'center',
      height: 17,
      justifyContent: 'center',
      marginTop: Style.globalMargins.tiny,
    },
    isMobile: {
      height: Style.globalMargins.medium,
    },
  }),
})

export default MinWriterRole
