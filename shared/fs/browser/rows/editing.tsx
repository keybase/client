import * as C from '@/constants'
import * as React from 'react'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import {rowStyles} from './common'
import {useFSState} from '@/stores/fs'
import * as FS from '@/stores/fs'

type Props = {
  editID: T.FS.EditID
}

function Editing({editID}: Props) {
  const {discardEdit, commitEdit, edit, setEditName} = useFSState(
    C.useShallow(s => ({
      commitEdit: s.dispatch.commitEdit,
      discardEdit: s.dispatch.discardEdit,
      edit: s.edits.get(editID) || FS.emptyNewFolder,
      setEditName: s.dispatch.setEditName,
    }))
  )
  const [filename, setFilename] = React.useState(edit.name)
  const onCancel = () => {
    discardEdit(editID)
  }
  const onSubmit = () => {
    commitEdit(editID)
  }
  React.useEffect(() => {
    setEditName(editID, filename)
  }, [editID, filename, setEditName])
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') onCancel()
  }
  return (
    <Kb.ListItem
      type="Small"
      firstItem={true /* we add divider in Rows */}
      statusIcon={
        <Kb.Icon2
          type={edit.type === T.FS.EditType.NewFolder ? 'iconfont-add' : 'iconfont-edit'}
          sizeType="Small"
          padding="xtiny"
        />
      }
      icon={
        <Kb.Box2 direction="vertical" style={rowStyles.pathItemIcon}>
          <Kb.ImageIcon type="icon-folder-32" />
        </Kb.Box2>
      }
      body={
        <Kb.Box2 direction="vertical" key="main" style={rowStyles.itemBox}>
          <Kb.Input3
            value={filename}
            placeholder={edit.originalName}
            selectTextOnFocus={true}
            inputStyle={styles.text}
            onEnterKeyDown={onSubmit}
            onChangeText={(name: string) => setFilename(name)}
            autoFocus={true}
            onKeyDown={onKeyDown}
            hideBorder={true}
          />
        </Kb.Box2>
      }
      action={
        <Kb.Box2 direction="horizontal" alignItems="center" key="right" style={styles.rightBox} justifyContent="flex-end">
          {!!edit.error && (
            <Kb.WithTooltip tooltip={edit.error} showOnPressMobile={true}>
              <Kb.Icon2 type="iconfont-exclamation" color={Kb.Styles.globalColors.red} />
            </Kb.WithTooltip>
          )}
          <Kb.WaitingButton
            key="create"
            style={styles.button}
            small={true}
            label={edit.error ? 'Retry' : edit.type === T.FS.EditType.NewFolder ? 'Create' : 'Save'}
            waitingKey={C.waitingKeyFSCommitEdit}
            onClick={onSubmit}
          />
          <Kb.Icon
            onClick={onCancel}
            type={edit.type === T.FS.EditType.NewFolder ? 'iconfont-trash' : 'iconfont-close'}
            color={Kb.Styles.globalColors.black_50}
            hoverColor={Kb.Styles.globalColors.black}
            style={styles.iconCancel}
          />
        </Kb.Box2>
      }
    />
  )
}

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
        flexShrink: 1,
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
