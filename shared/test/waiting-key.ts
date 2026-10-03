import type {WaitingKey} from '@/constants/waiting-key-type'

// A key a test makes up, which the registry does not hold
export const testWaitingKey = (s: string) => s as WaitingKey
