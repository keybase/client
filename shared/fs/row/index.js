// @flow
import * as React from 'react'
import * as Constants from '../../constants/fs'
import Placeholder from './placeholder'
import Still from './still-container'
import Editing from './editing-container'
import {compose, connect, setDisplayName, type TypedState} from '../../util/container'
import {Text} from '../../common-adapters'

const mapStateToProps = (state: TypedState, {path}) => ({
  pathItemType: (state.fs.pathItems.get(path) || Constants.makeUnknownPathItem()).type,
})

const Row = compose(connect(mapStateToProps), setDisplayName('Row'))(({path, pathItemType, routePath}) => {
  switch (pathItemType) {
    case 'folder':
    case 'file':
    case 'symlink':
    case 'unknown':
      return <Still path={path} routePath={routePath} />
    case 'new-folder':
      return <Editing path={path} routePath={routePath} />
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove: (pathItemType: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllActionTypesAbove(pathItemType);
      */
      return <Text type="BodyError">This shouldn't happen</Text>
  }
})

export {Row, Placeholder}
