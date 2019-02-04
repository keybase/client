// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import {rowStyles} from './common'
import PathItemIcon from '../common/path-item-icon'

type EditingProps = {
  name: string,
  projectedPath: Types.Path,
  hint: string,
  status: Types.EditStatusType,
  isCreate: boolean,
  onSubmit: () => void,
  onUpdate: (name: string) => void,
  onCancel: () => void,
}

const HoverClickableBox = Styles.isMobile
  ? Kb.ClickableBox
  : Styles.styled(Kb.ClickableBox)({
      '& .fs-path-item-editing-trash-icon': {color: Styles.globalColors.black_50},
      '& .fs-path-item-editing-trash-icon:hover': {color: Styles.globalColors.black_50},
    })

const Editing = (props: EditingProps) => (
  <Kb.Box style={rowStyles.rowBox}>
    <PathItemIcon
      path={props.projectedPath}
      size={32}
      type="folder"
      username=""
      style={rowStyles.pathItemIcon}
    />
    <Kb.Box key="main" style={rowStyles.itemBox}>
      <Kb.Input
        hideUnderline={true}
        small={true}
        value={props.name}
        hintText={props.hint}
        inputStyle={stylesText}
        onEnterKeyDown={props.onSubmit}
        onChangeText={name => props.onUpdate(name)}
        autoFocus={true}
        selectTextOnFocus={true}
      />
    </Kb.Box>
    <Kb.Box key="right" style={rowStyles.rightBox}>
      {props.status === 'failed' && <Kb.Text type="BodySmallError">Failed</Kb.Text>}
      <Kb.Button
        key="create"
        style={stylesButton}
        type="Primary"
        small={true}
        label={props.status === 'failed' ? 'Retry' : props.isCreate ? 'Create' : 'Save'}
        waiting={props.status === 'saving'}
        onClick={props.status === 'saving' ? undefined : props.onSubmit}
      />
      <HoverClickableBox style={stylesCancelBox} onClick={props.onCancel}>
        <Kb.Icon type="iconfont-trash" className="fs-path-item-editing-trash-icon" style={stylesIconCancel} />
      </HoverClickableBox>
    </Kb.Box>
  </Kb.Box>
)

const stylesCancelBox = {
  ...Styles.globalStyles.flexBoxRow,
  alignItems: 'center',
}

const stylesIconCancel = Styles.platformStyles({
  common: {
    padding: Styles.globalMargins.tiny,
    paddingRight: 0,
  },
  isMobile: {
    fontSize: 22,
  },
})

const stylesText = Styles.platformStyles({
  common: {
    ...Styles.globalStyles.fontSemibold,
    maxWidth: '100%',
  },
  isMobile: {marginTop: 22},
})

const stylesButton = {marginLeft: Styles.globalMargins.tiny}

export default Editing
