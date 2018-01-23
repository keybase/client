// @flow
import {connect, type TypedState, type Dispatch} from '../util/container'
import * as FSGen from '../actions/fs-gen'
import Files from '.'
import {navigateAppend} from '../actions/route-tree'
import * as Types from '../constants/types/fs'

type StateProps = {
  you: ?string,
  name: string,
  path: Types.FolderPath,
  visibility: Types.FolderVisibility,
}

const mapStateToProps = (state: TypedState): StateProps => {
  const you = state.config.username
  var items = []
  switch (state.path) {
    case '/keybase':
      items = [
        {key: 'private', visibility: 'private'},
        {key: 'public', visibility: 'public'},
        {key: 'team', visibility: 'team'},
      ]
    case '/keybase/private':
      items = [
        {visibility: 'private', key: you},
        {visibility: 'private', key: you + ',other'},
      ]
    case '/keybase/public':
      items = [
        {visibility: 'public', key: you},
        {visibility: 'public', key: 'other'},
      ]
    case '/keybase/private':
      items = [{visibility: 'team', key: you+'_team'}]
  }
  return {
    you: you,
    name: state.name,
    path: state.path,
    visibility: state.visibility,
    items: items.map((key, visibility) => ({key, visibility, type: 'folder' })),
  }
}

type DispatchProps = {
  onViewFolder: (path: Types.FolderPath) => void,
}

const mapDispatchToProps = (dispatch: Dispatch): DispatchProps => ({
  onViewFolder: (path: Types.FolderPath) => dispatch(navigateAppend([{props: {path}, selected: 'folder'}])),
})

export default connect(mapStateToProps, mapDispatchToProps)(Files)
