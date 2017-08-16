// @flow
import type {Delete, Merge, Replace, Subtract, EntityType} from '../constants/entities'

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
  payload: {entities, keyPath},
  type: 'entity:replace',
})

const subtractEntity: (keyPath: Array<string>, entities: Array<EntityType>) => Subtract = (
  keyPath,
  entities
) => ({
  payload: {entities, keyPath},
  type: 'entity:subtract',
})

export {deleteEntity, mergeEntity, replaceEntity, subtractEntity}
