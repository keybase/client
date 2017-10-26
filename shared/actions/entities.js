// @flow
import * as I from 'immutable'
import type {Delete, Merge, Replace, Subtract, EntityType} from '../constants/entities'

const deleteEntity: (keyPath: Array<string>, ids: I.List<string>) => Delete = (keyPath, ids) => ({
  payload: {ids, keyPath},
  type: 'entity:delete',
})

const mergeEntity: (
  keyPath: Array<string>,
  entities: I.Map<any, EntityType> | I.List<EntityType>
) => Merge = (keyPath, entities) => ({
  payload: {entities, keyPath},
  type: 'entity:merge',
})

const replaceEntity: (keyPath: Array<string>, entities: I.Map<any, EntityType>) => Replace = (
  keyPath,
  entities
) => ({
  payload: {entities, keyPath},
  type: 'entity:replace',
})

const subtractEntity: (keyPath: Array<string>, entities: I.List<EntityType>) => Subtract = (
  keyPath,
  entities
) => ({
  payload: {entities, keyPath},
  type: 'entity:subtract',
})

export {deleteEntity, mergeEntity, replaceEntity, subtractEntity}
