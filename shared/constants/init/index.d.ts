// links all the stores together, stores never import this
import type * as EngineGen from '@/constants/rpc'

export declare function initPlatformListener(): void
export declare function onEngineConnected(): void
export declare function onEngineDisconnected(): void
export declare function onEngineIncoming(action: EngineGen.Actions): void
