/* eslint-disable */

// This file is auto-generated. Run `yarn update-protocol` to regenerate it.




type SimpleError = {code?: number, desc?: string}
export type IncomingErrorCallback = (err?: SimpleError | null) => void



export type MessageTypes = {

}
export type MessageKey = keyof MessageTypes
export type RpcIn<M extends MessageKey> = MessageTypes[M]['inParam']
export type RpcOut<M extends MessageKey> = MessageTypes[M]['outParam']
export type RpcResponse<M extends MessageKey> = {error: IncomingErrorCallback, result: (res: RpcOut<M>) => void}
export type AuthResult = {readonly uid: UID,readonly username: string,readonly sid: SessionID,readonly isAdmin: boolean,}
export type Body = Uint8Array
export type Category = string
export type ConnectedDevice = {readonly deviceID: DeviceID,readonly deviceType: string,readonly devicePlatform: string,readonly userAgent: string,}
export type ConnectedUser = {readonly uid: UID,readonly devices?: ReadonlyArray<ConnectedDevice> | null,}
export type DeviceID = Uint8Array
export type Dismissal = {readonly msgIDs?: ReadonlyArray<MsgID> | null,readonly ranges?: ReadonlyArray<MsgRange> | null,}
export type DurationMsec = number
export type DurationSec = number
export type InBandMessage = {readonly stateUpdate?: StateUpdateMessage | null,readonly stateSync?: StateSyncMessage | null,}
export type Item = {readonly category: Category,readonly dtime: TimeOrOffset,readonly remindTimes?: ReadonlyArray<TimeOrOffset> | null,readonly body: Body,}
export type ItemAndMetadata = {readonly md?: Metadata | null,readonly item?: Item | null,}
export type Message = {readonly oobm?: OutOfBandMessage | null,readonly ibm?: InBandMessage | null,}
export type Metadata = {readonly uid: UID,readonly msgID: MsgID,readonly ctime: Time,readonly deviceID: DeviceID,readonly inBandMsgType: number,}
export type MsgID = Uint8Array
export type MsgRange = {readonly endTime: TimeOrOffset,readonly category: Category,readonly skipMsgIDs?: ReadonlyArray<MsgID> | null,}
export type OutOfBandMessage = {readonly uid: UID,readonly system: System,readonly body: Body,}
export type Reminder = {readonly item: ItemAndMetadata,readonly seqno: number,readonly remindTime: Time,}
export type ReminderID = {readonly uid: UID,readonly msgID: MsgID,readonly seqno: number,}
export type ReminderSet = {readonly reminders?: ReadonlyArray<Reminder> | null,readonly moreRemindersReady: boolean,}
export type SessionID = string
export type SessionToken = string
export type State = {readonly items?: ReadonlyArray<ItemAndMetadata> | null,}
export type StateSyncMessage = {readonly md: Metadata,}
export type StateUpdateMessage = {readonly md: Metadata,readonly creation?: Item | null,readonly dismissal?: Dismissal | null,}
export type SyncResult = {readonly msgs?: ReadonlyArray<InBandMessage> | null,readonly hash: Uint8Array,}
export type System = string
export type Time = number
export type TimeOrOffset = {readonly time: Time,readonly offset: DurationMsec,}
export type UID = Uint8Array

type IncomingMethod = never
export type IncomingCallMapType = Partial<{[M in IncomingMethod]: (params: RpcIn<M>) => void}>

type CustomIncomingMethod = never
export type CustomResponseIncomingCallMap = Partial<{[M in CustomIncomingMethod]: (params: RpcIn<M>, response: RpcResponse<M>) => void}>
// Not enabled calls. To enable add to enabled-calls.json:
// 'gregor.1.auth.authenticateSessionToken'
// 'gregor.1.authInternal.createGregorSuperUserSessionToken'
// 'gregor.1.authUpdate.revokeSessionIDs'
// 'gregor.1.incoming.sync'
// 'gregor.1.incoming.consumeMessage'
// 'gregor.1.incoming.consumePublishMessage'
// 'gregor.1.incoming.consumeMessageMulti'
// 'gregor.1.incoming.ping'
// 'gregor.1.incoming.version'
// 'gregor.1.incoming.state'
// 'gregor.1.incoming.stateByCategoryPrefix'
// 'gregor.1.incoming.describeConnectedUsers'
// 'gregor.1.incoming.describeConnectedUsersInternal'
// 'gregor.1.outgoing.broadcastMessage'
// 'gregor.1.remind.getReminders'
// 'gregor.1.remind.deleteReminders'