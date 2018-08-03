// @flow
import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as TeamTypes from '../../../../constants/types/teams'
import * as TeamConstants from '../../../../constants/teams'
import * as Style from '../../../../styles'
import {upperFirst} from 'lodash-es'

type Props = {
  canSetMinWriterRole: boolean,
  minWriterRole: TeamTypes.TeamRoleType,
  onSetNewRole: (newRole: TeamTypes.TeamRoleType) => void,
}

const _MinWriterRole = (props: Props & Kb.OverlayParentProps) => {
  const items = TeamConstants.teamRoleTypes.map(role => ({
    onClick: () => props.onSetNewRole(role),
    title: upperFirst(role),
  }))
  return (
    <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true} style={styles.container}>
      <Kb.Box2 direction="horizontal" fullWidth={true} gap="xtiny">
        <Kb.Text type="BodySmallSemibold">Minimum writer role</Kb.Text>
        <Kb.Icon
          type="iconfont-compose"
          color={Style.globalColors.black_20}
          fontSize={Style.isMobile ? 22 : 16}
        />
      </Kb.Box2>
      <Kb.ClickableBox
        style={styles.dropdown}
        ref={Style.isMobile ? null : props.setAttachmentRef}
        onClick={props.toggleShowingMenu}
        underlayColor={Style.globalColors.white_40}
      >
        <Kb.Box2 direction="horizontal" style={styles.label}>
          <Kb.Text type="BodySemibold">{upperFirst(props.minWriterRole)}</Kb.Text>
        </Kb.Box2>
        <Kb.Icon type="iconfont-caret-down" inheritColor={true} fontSize={7} />
      </Kb.ClickableBox>
      <Kb.FloatingMenu
        attachTo={props.attachmentRef}
        closeOnSelect={true}
        visible={props.showingMenu}
        items={items}
        onHidden={props.toggleShowingMenu}
        position="top center"
        positionFallbacks={['bottom center']}
      />
    </Kb.Box2>
  )
}
const MinWriterRole = Kb.OverlayParentHOC(_MinWriterRole)

const styles = Style.styleSheetCreate({
  container: {
    paddingLeft: Style.globalMargins.small,
    paddingRight: Style.globalMargins.small,
  },
  dropdown: Style.platformStyles({
    common: {
      ...Style.globalStyles.flexBoxRow,
      alignItems: 'center',
      borderColor: Style.globalColors.lightGrey2,
      borderRadius: 100,
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
})

export default MinWriterRole
