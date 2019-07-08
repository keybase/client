import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import * as Styles from '../../../styles'
import * as Kb from '../../../common-adapters'
import {rowStyles} from './common'
import PathItemIcon from '../../common/path-item-icon'

type EditingProps = {
  name: string
  projectedPath: Types.Path
  hint: string
  status: Types.EditStatusType
  isCreate: boolean
  onSubmit: () => void
  onUpdate: (name: string) => void
  onCancel: () => void
}

const Editing = (props: EditingProps) => {
  const [filename, setFilename] = React.useState(props.name)
  return (
    <Kb.ListItem2
      type="Small"
      firstItem={true /* we add divider in Rows */}
      icon={
        <PathItemIcon
          path={props.projectedPath}
          size={32}
          type={Types.PathType.Folder}
          username=""
          style={rowStyles.pathItemIcon}
        />
      }
      body={
        <Kb.Box key="main" style={rowStyles.itemBox}>
          <Kb.Input
            hideUnderline={true}
            small={true}
            value={filename}
            hintText={props.hint}
            inputStyle={styles.text}
            onEnterKeyDown={props.onSubmit}
            onChangeText={name => {
              setFilename(name)
              props.onUpdate(name)
            }}
            autoFocus={true}
            selectTextOnFocus={true}
          />
        </Kb.Box>
      }
      action={
        <Kb.Box key="right" style={styles.rightBox}>
          {props.status === Types.EditStatusType.Failed && <Kb.Text type="BodySmallError">Failed</Kb.Text>}
          <Kb.Button
            key="create"
            style={styles.button}
            small={true}
            label={
              props.status === Types.EditStatusType.Failed ? 'Retry' : props.isCreate ? 'Create' : 'Save'
            }
            waiting={props.status === Types.EditStatusType.Saving}
            onClick={props.status === Types.EditStatusType.Saving ? undefined : props.onSubmit}
          />
          <Kb.Icon
            onClick={props.onCancel}
            type="iconfont-trash"
            color={Styles.globalColors.black_50}
            hoverColor={Styles.globalColors.black}
            style={styles.iconCancel}
          />
        </Kb.Box>
      }
    />
  )
}

const styles = Styles.styleSheetCreate({
  button: {
    marginLeft: Styles.globalMargins.tiny,
  },
  iconCancel: Styles.platformStyles({
    common: {
      padding: Styles.globalMargins.tiny,
      paddingRight: 0,
    },
    isMobile: {
      fontSize: 22,
    },
  }),
  rightBox: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    flexShrink: 1,
    justifyContent: 'flex-end',
  },
  text: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.fontSemibold,
      maxWidth: '100%',
    },
    isMobile: {marginTop: 22},
  }),
})

export default Editing
