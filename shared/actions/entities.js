// @flow
import type {Delete, DeleteAll, Merge, Replace, EntityType} from '../constants/entities'

const deleteEntity: (keyPath: Array<string>, ids: Array<string>) => Delete = (keyPath, ids) => ({
  payload: {ids, keyPath},
  type: 'entity:delete',
})

const deleteAll: (keyPath: Array<string>) => DeleteAll = (keyPath) => ({
  payload: {keyPath},
  type: 'entity:deleteAll',
})

const mergeEntity: (keyPath: Array<string>, entities: {[id: string]: EntityType}) => Merge = (keyPath, entities) => ({
  payload: {entities, keyPath},
  type: 'entity:merge',
})

const replaceEntity: (keyPath: Array<string>, entities: {[id: string]: EntityType}) => Replace = (keyPath, entities) => ({
  payload: {entities, keyPath},
  type: 'entity:replace',
})

export {
  deleteAll,
  deleteEntity,
  mergeEntity,
  replaceEntity,
}
