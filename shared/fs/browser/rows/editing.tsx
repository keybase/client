import * as C from '@/constants'
import * as Constants from '@/constants/fs'
import * as React from 'react'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import {rowStyles} from './common'

type Props = {
  editID: T.FS.EditID
}

const Editing = React.memo(function ({editID}: Props) {
  const discardEdit = C.useFSState(s => s.dispatch.discardEdit)
  const onCancel = () => {
    discardEdit(editID)
  }
  const commitEdit = C.useFSState(s => s.dispatch.commitEdit)
  const onSubmit = () => {
    commitEdit(editID)
  }
  const edit = C.useFSState(s => s.edits.get(editID) || Constants.emptyNewFolder)
  const [filename, setFilename] = React.useState(edit.name)
  const setEditName = C.useFSState(s => s.dispatch.setEditName)
  React.useEffect(() => {
    setEditName(editID, filename)
  }, [editID, filename, setEditName])
  const onKeyUp = (event: React.KeyboardEvent) => event.key === 'Escape' && onCancel()
  return (
    <Kb.ListItem2
      type="Small"
      firstItem={true /* we add divider in Rows */}
      statusIcon={
        <Kb.Icon
          type={edit.type === T.FS.EditType.NewFolder ? 'iconfont-add' : 'iconfont-edit'}
          sizeType="Small"
          padding="xtiny"
        />
      }
      icon={
        <Kb.Box style={rowStyles.pathItemIcon}>
          <Kb.Icon type="icon-folder-32" />
        </Kb.Box>
      }
      body={
        <Kb.Box key="main" style={rowStyles.itemBox}>
          <Kb.PlainInput
            value={filename}
            placeholder={edit.originalName}
            selectTextOnFocus={true}
            style={styles.text}
            onEnterKeyDown={onSubmit}
            onChangeText={name => setFilename(name)}
            autoFocus={true}
            onKeyUp={onKeyUp}
          />
        </Kb.Box>
      }
      action={
        <Kb.Box key="right" style={styles.rightBox}>
          {!!edit.error && (
            <Kb.WithTooltip tooltip={edit.error} showOnPressMobile={true}>
              <Kb.Icon type="iconfont-exclamation" color={Kb.Styles.globalColors.red} />
            </Kb.WithTooltip>
          )}
          <Kb.WaitingButton
            key="create"
            style={styles.button}
            small={true}
            label={edit.error ? 'Retry' : edit.type === T.FS.EditType.NewFolder ? 'Create' : 'Save'}
            waitingKey={Constants.commitEditWaitingKey}
            onClick={onSubmit}
          />
          <Kb.Icon
            onClick={onCancel}
            type={edit.type === T.FS.EditType.NewFolder ? 'iconfont-trash' : 'iconfont-close'}
            color={Kb.Styles.globalColors.black_50}
            hoverColor={Kb.Styles.globalColors.black}
            style={styles.iconCancel}
          />
        </Kb.Box>
      }
    />
  )
})

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      button: {
        marginLeft: Kb.Styles.globalMargins.tiny,
      },
      iconCancel: Kb.Styles.platformStyles({
        common: {
          padding: Kb.Styles.globalMargins.tiny,
          paddingRight: 0,
        },
        isMobile: {
          fontSize: 22,
        },
      }),
      rightBox: {
        ...Kb.Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        flexShrink: 1,
        justifyContent: 'flex-end',
      },
      text: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.globalStyles.fontSemibold,
          maxWidth: '100%',
        },
      }),
    }) as const
)

export default Editing
