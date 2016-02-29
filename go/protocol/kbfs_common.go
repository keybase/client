package keybase1

import (
	rpc "github.com/keybase/go-framed-msgpack-rpc"
)

type FSStatusCode int

const (
	FSStatusCode_START  FSStatusCode = 0
	FSStatusCode_FINISH FSStatusCode = 1
	FSStatusCode_ERROR  FSStatusCode = 2
)

type FSNotificationType int

const (
	FSNotificationType_ENCRYPTING FSNotificationType = 0
	FSNotificationType_DECRYPTING FSNotificationType = 1
	FSNotificationType_SIGNING    FSNotificationType = 2
	FSNotificationType_VERIFYING  FSNotificationType = 3
	FSNotificationType_REKEYING   FSNotificationType = 4
	FSNotificationType_CONNECTION FSNotificationType = 5
)

type FSNotification struct {
	PublicTopLevelFolder bool               `codec:"publicTopLevelFolder" json:"publicTopLevelFolder"`
	Filename             string             `codec:"filename" json:"filename"`
	Status               string             `codec:"status" json:"status"`
	StatusCode           FSStatusCode       `codec:"statusCode" json:"statusCode"`
	NotificationType     FSNotificationType `codec:"notificationType" json:"notificationType"`
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
