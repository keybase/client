import type * as React from 'react'
import * as Kb from '@/common-adapters'
import {rowStyles} from './common'
import * as T from '@/constants/types'
import type {BrowserEditSession} from '../edit-state'

type Props = {
  editSession: BrowserEditSession
}

function Editing({editSession}: Props) {
  const {commitEdit, discardEdit, edit} = editSession
  const onCancel = () => {
    discardEdit()
  }
  const onSubmit = () => {
    commitEdit()
  }
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') onCancel()
  }
  return (
    <Kb.ListItem
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
        <Kb.Box2 direction="vertical" style={rowStyles.pathItemIcon}>
          <Kb.ImageIcon type="icon-folder-32" />
        </Kb.Box2>
      }
      body={
        <Kb.Box2 direction="vertical" key="main" style={rowStyles.itemBox}>
          <Kb.Input3
            value={edit.name}
            placeholder={edit.originalName}
            selectTextOnFocus={true}
            inputStyle={styles.text}
            onEnterKeyDown={onSubmit}
            onChangeText={editSession.setEditName}
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
              <Kb.Icon type="iconfont-exclamation" color={Kb.Styles.globalColors.red} />
            </Kb.WithTooltip>
          )}
          <Kb.Button
            key="create"
            style={styles.button}
            small={true}
            label={edit.error ? 'Retry' : edit.type === T.FS.EditType.NewFolder ? 'Create' : 'Save'}
            waiting={editSession.isSubmitting}
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
