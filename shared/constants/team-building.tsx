import type * as T from './types'

const searchServices: Array<T.TB.ServiceId> = ['keybase', 'twitter', 'github', 'reddit', 'hackernews']

export const allServices: Array<T.TB.ServiceIdWithContact> = [
  ...searchServices.slice(0, 1),
  'phone',
  'email',
  ...searchServices.slice(1),
]

export const selfToUser = (you: string): T.TB.User => ({
  id: you,
  prettyName: you,
  serviceId: 'keybase' as const,
  serviceMap: {},
  username: you,
})
