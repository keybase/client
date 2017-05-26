// @flow
import * as Immutable from 'immutable'
import type {Delete, Merge, Replace, EntityType} from '../constants/entities'

const deleteEntity: (keyPath: Array<string>, ids: Array<string>) => Delete = (keyPath, ids) => ({
  payload: {ids, keyPath},
  type: 'entity:delete',
})

const mergeEntity: (keyPath: Array<string>, entities: {[id: string]: EntityType}) => Merge = (
  keyPath,
  entities
) => ({
  payload: {entities, keyPath},
  type: 'entity:merge',
})

const replaceEntity: (keyPath: Array<string>, entities: {[id: string]: EntityType}) => Replace = (
  keyPath,
  entities
) => ({
  payload: {entities: new Immutable.Map(entities), keyPath},
  type: 'entity:replace',
})

export {deleteEntity, mergeEntity, replaceEntity}
