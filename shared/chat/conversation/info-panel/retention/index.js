// @flow
import * as React from 'react'
import RetentionPicker, {type OwnProps} from '../../../../teams/team/settings/retention/container'
import {HOCTimers} from '../../../../common-adapters'
import {SaveStateComponent, type SaveStateType} from '../notifications'

type Props = OwnProps & {
  saving: boolean,
  setTimeout: typeof setTimeout,
  clearTimeout: typeof clearTimeout,
}

type State = {saveState: SaveStateType}

class RetentionWithSaveState extends React.Component<Props, State> {
  state = {saveState: 'same'}
  render() {
    return (
      <React.Fragment>
        <RetentionPicker {...this.props} />
      </React.Fragment>
    )
  }
}

export default HOCTimers(RetentionWithSaveState)
