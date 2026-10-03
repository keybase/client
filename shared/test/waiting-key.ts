import type * as T from '@/constants/types'

// A key a test makes up, which the registry does not hold
export const testWaitingKey = (s: string) => s as T.Waiting.WaitingKey
