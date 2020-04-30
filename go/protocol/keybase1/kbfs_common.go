// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/kbfs_common.avdl

package keybase1

import (
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type FSStatusCode int

const (
	FSStatusCode_START  FSStatusCode = 0
	FSStatusCode_FINISH FSStatusCode = 1
	FSStatusCode_ERROR  FSStatusCode = 2
)

func (o FSStatusCode) DeepCopy() FSStatusCode { return o }

var FSStatusCodeMap = map[string]FSStatusCode{
	"START":  0,
	"FINISH": 1,
	"ERROR":  2,
}

var FSStatusCodeRevMap = map[FSStatusCode]string{
	0: "START",
	1: "FINISH",
	2: "ERROR",
}

func (e FSStatusCode) String() string {
	if v, ok := FSStatusCodeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type FSNotificationType int

const (
	FSNotificationType_ENCRYPTING          FSNotificationType = 0
	FSNotificationType_DECRYPTING          FSNotificationType = 1
	FSNotificationType_SIGNING             FSNotificationType = 2
	FSNotificationType_VERIFYING           FSNotificationType = 3
	FSNotificationType_REKEYING            FSNotificationType = 4
	FSNotificationType_CONNECTION          FSNotificationType = 5
	FSNotificationType_MD_READ_SUCCESS     FSNotificationType = 6
	FSNotificationType_FILE_CREATED        FSNotificationType = 7
	FSNotificationType_FILE_MODIFIED       FSNotificationType = 8
	FSNotificationType_FILE_DELETED        FSNotificationType = 9
	FSNotificationType_FILE_RENAMED        FSNotificationType = 10
	FSNotificationType_INITIALIZED         FSNotificationType = 11
	FSNotificationType_SYNC_CONFIG_CHANGED FSNotificationType = 12
)

func (o FSNotificationType) DeepCopy() FSNotificationType { return o }

var FSNotificationTypeMap = map[string]FSNotificationType{
	"ENCRYPTING":          0,
	"DECRYPTING":          1,
	"SIGNING":             2,
	"VERIFYING":           3,
	"REKEYING":            4,
	"CONNECTION":          5,
	"MD_READ_SUCCESS":     6,
	"FILE_CREATED":        7,
	"FILE_MODIFIED":       8,
	"FILE_DELETED":        9,
	"FILE_RENAMED":        10,
	"INITIALIZED":         11,
	"SYNC_CONFIG_CHANGED": 12,
}

var FSNotificationTypeRevMap = map[FSNotificationType]string{
	0:  "ENCRYPTING",
	1:  "DECRYPTING",
	2:  "SIGNING",
	3:  "VERIFYING",
	4:  "REKEYING",
	5:  "CONNECTION",
	6:  "MD_READ_SUCCESS",
	7:  "FILE_CREATED",
	8:  "FILE_MODIFIED",
	9:  "FILE_DELETED",
	10: "FILE_RENAMED",
	11: "INITIALIZED",
	12: "SYNC_CONFIG_CHANGED",
}

func (e FSNotificationType) String() string {
	if v, ok := FSNotificationTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type FSErrorType int

const (
	FSErrorType_ACCESS_DENIED             FSErrorType = 0
	FSErrorType_USER_NOT_FOUND            FSErrorType = 1
	FSErrorType_REVOKED_DATA_DETECTED     FSErrorType = 2
	FSErrorType_NOT_LOGGED_IN             FSErrorType = 3
	FSErrorType_TIMEOUT                   FSErrorType = 4
	FSErrorType_REKEY_NEEDED              FSErrorType = 5
	FSErrorType_BAD_FOLDER                FSErrorType = 6
	FSErrorType_NOT_IMPLEMENTED           FSErrorType = 7
	FSErrorType_OLD_VERSION               FSErrorType = 8
	FSErrorType_OVER_QUOTA                FSErrorType = 9
	FSErrorType_NO_SIG_CHAIN              FSErrorType = 10
	FSErrorType_TOO_MANY_FOLDERS          FSErrorType = 11
	FSErrorType_EXDEV_NOT_SUPPORTED       FSErrorType = 12
	FSErrorType_DISK_LIMIT_REACHED        FSErrorType = 13
	FSErrorType_DISK_CACHE_ERROR_LOG_SEND FSErrorType = 14
	FSErrorType_OFFLINE_ARCHIVED          FSErrorType = 15
	FSErrorType_OFFLINE_UNSYNCED          FSErrorType = 16
)

func (o FSErrorType) DeepCopy() FSErrorType { return o }

var FSErrorTypeMap = map[string]FSErrorType{
	"ACCESS_DENIED":             0,
	"USER_NOT_FOUND":            1,
	"REVOKED_DATA_DETECTED":     2,
	"NOT_LOGGED_IN":             3,
	"TIMEOUT":                   4,
	"REKEY_NEEDED":              5,
	"BAD_FOLDER":                6,
	"NOT_IMPLEMENTED":           7,
	"OLD_VERSION":               8,
	"OVER_QUOTA":                9,
	"NO_SIG_CHAIN":              10,
	"TOO_MANY_FOLDERS":          11,
	"EXDEV_NOT_SUPPORTED":       12,
	"DISK_LIMIT_REACHED":        13,
	"DISK_CACHE_ERROR_LOG_SEND": 14,
	"OFFLINE_ARCHIVED":          15,
	"OFFLINE_UNSYNCED":          16,
}

var FSErrorTypeRevMap = map[FSErrorType]string{
	0:  "ACCESS_DENIED",
	1:  "USER_NOT_FOUND",
	2:  "REVOKED_DATA_DETECTED",
	3:  "NOT_LOGGED_IN",
	4:  "TIMEOUT",
	5:  "REKEY_NEEDED",
	6:  "BAD_FOLDER",
	7:  "NOT_IMPLEMENTED",
	8:  "OLD_VERSION",
	9:  "OVER_QUOTA",
	10: "NO_SIG_CHAIN",
	11: "TOO_MANY_FOLDERS",
	12: "EXDEV_NOT_SUPPORTED",
	13: "DISK_LIMIT_REACHED",
	14: "DISK_CACHE_ERROR_LOG_SEND",
	15: "OFFLINE_ARCHIVED",
	16: "OFFLINE_UNSYNCED",
}

func (e FSErrorType) String() string {
	if v, ok := FSErrorTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type FSNotification struct {
	Filename         string             `codec:"filename" json:"filename"`
	Status           string             `codec:"status" json:"status"`
	StatusCode       FSStatusCode       `codec:"statusCode" json:"statusCode"`
	NotificationType FSNotificationType `codec:"notificationType" json:"notificationType"`
	ErrorType        FSErrorType        `codec:"errorType" json:"errorType"`
	Params           map[string]string  `codec:"params" json:"params"`
	WriterUid        UID                `codec:"writerUid" json:"writerUid"`
	LocalTime        Time               `codec:"localTime" json:"localTime"`
	FolderType       FolderType         `codec:"folderType" json:"folderType"`
}

func (o FSNotification) DeepCopy() FSNotification {
	return FSNotification{
		Filename:         o.Filename,
		Status:           o.Status,
		StatusCode:       o.StatusCode.DeepCopy(),
		NotificationType: o.NotificationType.DeepCopy(),
		ErrorType:        o.ErrorType.DeepCopy(),
		Params: (func(x map[string]string) map[string]string {
			if x == nil {
				return nil
			}
			ret := make(map[string]string, len(x))
			for k, v := range x {
				kCopy := k
				vCopy := v
				ret[kCopy] = vCopy
			}
			return ret
		})(o.Params),
		WriterUid:  o.WriterUid.DeepCopy(),
		LocalTime:  o.LocalTime.DeepCopy(),
		FolderType: o.FolderType.DeepCopy(),
	}
}

type FSEditListRequest struct {
	Folder    Folder `codec:"folder" json:"folder"`
	RequestID int    `codec:"requestID" json:"requestID"`
}

func (o FSEditListRequest) DeepCopy() FSEditListRequest {
	return FSEditListRequest{
		Folder:    o.Folder.DeepCopy(),
		RequestID: o.RequestID,
	}
}

type FSFolderWriterEdit struct {
	Filename         string             `codec:"filename" json:"filename"`
	NotificationType FSNotificationType `codec:"notificationType" json:"notificationType"`
	ServerTime       Time               `codec:"serverTime" json:"serverTime"`
}

func (o FSFolderWriterEdit) DeepCopy() FSFolderWriterEdit {
	return FSFolderWriterEdit{
		Filename:         o.Filename,
		NotificationType: o.NotificationType.DeepCopy(),
		ServerTime:       o.ServerTime.DeepCopy(),
	}
}

type FSFolderWriterEditHistory struct {
	WriterName string               `codec:"writerName" json:"writerName"`
	Edits      []FSFolderWriterEdit `codec:"edits" json:"edits"`
	Deletes    []FSFolderWriterEdit `codec:"deletes" json:"deletes"`
}

func (o FSFolderWriterEditHistory) DeepCopy() FSFolderWriterEditHistory {
	return FSFolderWriterEditHistory{
		WriterName: o.WriterName,
		Edits: (func(x []FSFolderWriterEdit) []FSFolderWriterEdit {
			if x == nil {
				return nil
			}
			ret := make([]FSFolderWriterEdit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Edits),
		Deletes: (func(x []FSFolderWriterEdit) []FSFolderWriterEdit {
			if x == nil {
				return nil
			}
			ret := make([]FSFolderWriterEdit, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Deletes),
	}
}

type FSFolderEditHistory struct {
	Folder     Folder                      `codec:"folder" json:"folder"`
	ServerTime Time                        `codec:"serverTime" json:"serverTime"`
	History    []FSFolderWriterEditHistory `codec:"history" json:"history"`
}

func (o FSFolderEditHistory) DeepCopy() FSFolderEditHistory {
	return FSFolderEditHistory{
		Folder:     o.Folder.DeepCopy(),
		ServerTime: o.ServerTime.DeepCopy(),
		History: (func(x []FSFolderWriterEditHistory) []FSFolderWriterEditHistory {
			if x == nil {
				return nil
			}
			ret := make([]FSFolderWriterEditHistory, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.History),
	}
}

type FSSyncStatusRequest struct {
	RequestID int `codec:"requestID" json:"requestID"`
}

func (o FSSyncStatusRequest) DeepCopy() FSSyncStatusRequest {
	return FSSyncStatusRequest{
		RequestID: o.RequestID,
	}
}

type FSPathSyncStatus struct {
	FolderType   FolderType `codec:"folderType" json:"folderType"`
	Path         string     `codec:"path" json:"path"`
	SyncingBytes int64      `codec:"syncingBytes" json:"syncingBytes"`
	SyncingOps   int64      `codec:"syncingOps" json:"syncingOps"`
	SyncedBytes  int64      `codec:"syncedBytes" json:"syncedBytes"`
}

func (o FSPathSyncStatus) DeepCopy() FSPathSyncStatus {
	return FSPathSyncStatus{
		FolderType:   o.FolderType.DeepCopy(),
		Path:         o.Path,
		SyncingBytes: o.SyncingBytes,
		SyncingOps:   o.SyncingOps,
		SyncedBytes:  o.SyncedBytes,
	}
}

type FSSyncStatus struct {
	TotalSyncingBytes int64    `codec:"totalSyncingBytes" json:"totalSyncingBytes"`
	SyncingPaths      []string `codec:"syncingPaths" json:"syncingPaths"`
	EndEstimate       *Time    `codec:"endEstimate,omitempty" json:"endEstimate,omitempty"`
}

func (o FSSyncStatus) DeepCopy() FSSyncStatus {
	return FSSyncStatus{
		TotalSyncingBytes: o.TotalSyncingBytes,
		SyncingPaths: (func(x []string) []string {
			if x == nil {
				return nil
			}
			ret := make([]string, len(x))
			for i, v := range x {
				vCopy := v
				ret[i] = vCopy
			}
			return ret
		})(o.SyncingPaths),
		EndEstimate: (func(x *Time) *Time {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.EndEstimate),
	}
}

type FolderSyncStatus struct {
	LocalDiskBytesAvailable int64            `codec:"localDiskBytesAvailable" json:"localDiskBytesAvailable"`
	LocalDiskBytesTotal     int64            `codec:"localDiskBytesTotal" json:"localDiskBytesTotal"`
	PrefetchStatus          PrefetchStatus   `codec:"prefetchStatus" json:"prefetchStatus"`
	PrefetchProgress        PrefetchProgress `codec:"prefetchProgress" json:"prefetchProgress"`
	StoredBytesTotal        int64            `codec:"storedBytesTotal" json:"storedBytesTotal"`
	OutOfSyncSpace          bool             `codec:"outOfSyncSpace" json:"outOfSyncSpace"`
}

func (o FolderSyncStatus) DeepCopy() FolderSyncStatus {
	return FolderSyncStatus{
		LocalDiskBytesAvailable: o.LocalDiskBytesAvailable,
		LocalDiskBytesTotal:     o.LocalDiskBytesTotal,
		PrefetchStatus:          o.PrefetchStatus.DeepCopy(),
		PrefetchProgress:        o.PrefetchProgress.DeepCopy(),
		StoredBytesTotal:        o.StoredBytesTotal,
		OutOfSyncSpace:          o.OutOfSyncSpace,
	}
}

type KbfsCommonInterface interface {
}

func KbfsCommonProtocol(i KbfsCommonInterface) rpc.Protocol {
	return rpc.Protocol{
		Name:    "keybase.1.kbfsCommon",
		Methods: map[string]rpc.ServeHandlerDescription{},
	}
}

type KbfsCommonClient struct {
	Cli rpc.GenericClient
}
