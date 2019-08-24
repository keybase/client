import * as I from 'immutable'
import {namedConnect} from '../../../util/container'
import * as Types from '../../../constants/types/fs'
import * as RowTypes from './types'
import * as Constants from '../../../constants/fs'
import {isMobile} from '../../../constants/platform'
import {sortRowItems, SortableRowItem} from './sort'
import Rows, {Props} from './rows'
import {asRows as topBarAsRow} from '../../top-bar'
import {memoize} from '../../../util/memoize'

type OwnProps = {
  path: Types.Path // path to the parent folder containering the rows,
  destinationPickerIndex?: number
  headerRows?: Array<RowTypes.HeaderRowItem> | null
}

const getEditingRows = memoize(
  (edits: I.Map<Types.EditID, Types.Edit>, parentPath: Types.Path): I.List<RowTypes.EditingRowItem> =>
    I.List(
      edits
        .filter(edit => edit.parentPath === parentPath)
        .toArray()
        .map(([editID, edit]) => ({
          editID,
          editType: edit.type,
          key: `edit:${Types.editIDToString(editID)}`,
          name: edit.name,
          // fields for sortable
          rowType: RowTypes.RowType.Editing,
          type: Types.PathType.Folder,
        }))
    )
)

const getStillRows = memoize(
  (
    pathItems: I.Map<Types.Path, Types.PathItem>,
    parentPath: Types.Path,
    names: I.Set<string>
  ): I.List<RowTypes.StillRowItem> =>
    I.List(
      names.toArray().reduce<Array<RowTypes.StillRowItem>>((items, name) => {
        const item = pathItems.get(Types.pathConcat(parentPath, name), Constants.unknownPathItem)
        const path = Types.pathConcat(parentPath, item.name)
        return [
          ...items,
          {
            key: `still:${name}`,
            lastModifiedTimestamp: item.lastModifiedTimestamp,
            name: item.name,
            path,
            // fields for sortable
            rowType: RowTypes.RowType.Still,
            type: item.type,
          },
        ]
      }, [])
    )
)

// TODO: when we have renames, reconcile editing rows in here too.
const amendStillRowsWithUploads = memoize(
  (stills: I.List<RowTypes.StillRowItem>, uploads: Types.Uploads): I.List<SortableRowItem> =>
    stills.map(still => {
      const {name, type, path} = still
      if (type === Types.PathType.Folder) {
        // Don't show an upload row for folders.
        return still
      }
      if (!uploads.writingToJournal.has(path) && !uploads.syncingPaths.has(path)) {
        // The entry is absent from uploads. So just show a still row.
        return still
      }
      return {
        key: `uploading:${name}`,
        name,
        path,
        rowType: RowTypes.RowType.Uploading,
        // field for sortable
        type,
      } as RowTypes.UploadingRowItem
    })
)

const _getPlaceholderRows = (type): I.List<RowTypes.PlaceholderRowItem> =>
  I.List([
    {key: 'placeholder:1', name: '1', rowType: RowTypes.RowType.Placeholder, type},
    {key: 'placeholder:2', name: '2', rowType: RowTypes.RowType.Placeholder, type},
    {key: 'placeholder:3', name: '3', rowType: RowTypes.RowType.Placeholder, type},
  ])
const filePlaceholderRows = _getPlaceholderRows(Types.PathType.File)
const folderPlaceholderRows = _getPlaceholderRows(Types.PathType.Folder)

const _makeInTlfRows = memoize((editingRows, amendedStillRows) => editingRows.concat(amendedStillRows))

const getInTlfItemsFromStateProps = (stateProps, path: Types.Path): I.List<RowTypes.NamedRowItem> => {
  const _pathItem = stateProps._pathItems.get(path, Constants.unknownPathItem)
  if (_pathItem.type !== Types.PathType.Folder) {
    return filePlaceholderRows
  }

  if (_pathItem.progress === Types.ProgressType.Pending) {
    return filePlaceholderRows
  }

  const editingRows = getEditingRows(stateProps._edits, path)
  const stillRows = getStillRows(stateProps._pathItems, path, _pathItem.children)

  return sortRowItems(
    _makeInTlfRows(editingRows, amendStillRowsWithUploads(stillRows, stateProps._uploads)),
    stateProps._sortSetting,
    ''
  )
}

const getTlfRowsFromTlfs = memoize(
  (tlfs: I.Map<string, Types.Tlf>, tlfType: Types.TlfType): I.List<SortableRowItem> =>
    I.List().withMutations(list =>
      tlfs.reduce(
        (rows, {isIgnored, isNew, tlfMtime}, name) =>
          isIgnored
            ? rows
            : rows.push({
                isNew,
                key: `tlf:${name}`,
                name,
                rowType: RowTypes.RowType.Tlf,
                tlfMtime,
                tlfType,
                type: Types.PathType.Folder,
              }),
        list
      )
    )
)

const getTlfItemsFromStateProps = (stateProps, path): I.List<RowTypes.NamedRowItem> => {
  if (stateProps._tlfs.private.count() === 0) {
    // /keybase/private/<me> is always favorited. If it's not there it must be
    // unintialized.
    return folderPlaceholderRows
  }

  const {tlfList, tlfType} = Constants.getTlfListAndTypeFromPath(stateProps._tlfs, path)
  return sortRowItems(
    getTlfRowsFromTlfs(tlfList, tlfType),
    stateProps._sortSetting,
    (Types.pathIsNonTeamTLFList(path) && stateProps._username) || ''
  )
}

const getNormalRowItemsFromStateProps = (stateProps, path): I.List<RowTypes.NamedRowItem> => {
  const level = Types.getPathLevel(path)
  switch (level) {
    case 0:
    case 1:
      return I.List() // should never happen
    case 2:
      return getTlfItemsFromStateProps(stateProps, path)
    default:
      return getInTlfItemsFromStateProps(stateProps, path)
  }
}

const filterable = new Set([RowTypes.RowType.TlfType, RowTypes.RowType.Tlf, RowTypes.RowType.Still])
const filterRowItems = (rows, filter) =>
  filter ? rows.filter(row => !filterable.has(row.rowType) || row.name.includes(filter)) : rows

export default namedConnect(
  (state, {path}: OwnProps) => ({
    _edits: state.fs.edits,
    _filter: state.fs.folderViewFilter,
    _pathItems: state.fs.pathItems,
    _sortSetting: Constants.getPathUserSetting(state.fs.pathUserSettings, path).sort,
    _tlfs: state.fs.tlfs,
    _uploads: state.fs.uploads,
    _username: state.config.username,
  }),
  () => ({}),
  (s, _, o: OwnProps) => {
    const normalRowItems = getNormalRowItemsFromStateProps(s, o.path)
    const filteredRowItems = filterRowItems(normalRowItems, s._filter)
    return {
      destinationPickerIndex: o.destinationPickerIndex,
      emptyMode: !normalRowItems.size
        ? 'empty'
        : !filteredRowItems.size
        ? 'not-empty-but-no-match'
        : ('not-empty' as Props['emptyMode']),
      items: I.List([
        ...(o.headerRows || []),
        // don't show top bar in destinationPicker.
        ...(typeof o.destinationPickerIndex === 'number' ? [] : topBarAsRow(o.path)),
      ])
        .concat(filteredRowItems)
        .concat(
          // If we are in the destination picker, inject two empty rows so when
          // user scrolls to the bottom nothing is blocked by the
          // semi-transparent footer.
          //
          // TODO: add `footerRows` and inject these from destination-picker, so that
          // Rows componenet don't need to worry about whether it's in
          // destinationPicker mode or not.
          !isMobile && typeof o.destinationPickerIndex === 'number'
            ? [
                {key: 'empty:0', rowType: RowTypes.RowType.Empty},
                {key: 'empty:1', rowType: RowTypes.RowType.Empty},
              ]
            : []
        ),
      path: o.path,
    }
  },
  'ConnectedRows'
)(Rows)
