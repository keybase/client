export type OutOfDate = {
  critical: boolean
  message: string
  updating: boolean
  outOfDate: boolean
}
export type DaemonHandshakeState = 'starting' | 'waitingForWaiters' | 'done'
export type ConfiguredAccount = {
  fullname?: string
  hasStoredSecret: boolean
  username: string
}
