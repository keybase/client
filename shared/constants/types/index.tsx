export * as FS from './fs'
export * as Chat from './chat2'
export * as Config from './config'
export * as Crypto from './crypto'
export * as Devices from './devices'
export * as Git from './git'
export * as More from './more'
export * as People from './people'
export * as Push from './push'
export * as RPCChat from './rpc-chat-gen'
export * as RPCGen from './rpc-gen'
export * as RPCGregor from './rpc-gregor-gen'
export * as RPCStellar from './rpc-stellar-gen'
export * as TB from './team-building'
export * as Teams from './teams'
export * as Tracker from './tracker2'
export * as Users from './users'
export * as Waiting from './waiting'
export * as Wallets from './wallets'
export type * as Retention from './retention-policy'

export type Unpacked<T> = T extends (infer U)[]
  ? U
  : T extends (...args: any[]) => infer U
  ? U
  : T extends Promise<infer U>
  ? U
  : T
