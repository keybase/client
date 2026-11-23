// Code generated to Go types and interfaces using avdl-compiler v1.4.10 (https://github.com/keybase/node-avdl-compiler). DO NOT EDIT.
//   Input file: avdl/stellar1/common.avdl

package stellar1

import (
	"fmt"

	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type AccountID string

func (o AccountID) DeepCopy() AccountID {
	return o
}

type SecretKey string

func (o SecretKey) DeepCopy() SecretKey {
	return o
}

type TransactionID string

func (o TransactionID) DeepCopy() TransactionID {
	return o
}

type PaymentID string

func (o PaymentID) DeepCopy() PaymentID {
	return o
}

type KeybaseRequestID string

func (o KeybaseRequestID) DeepCopy() KeybaseRequestID {
	return o
}

type Hash []byte

func (o Hash) DeepCopy() Hash {
	return (func(x []byte) []byte {
		if x == nil {
			return nil
		}
		return append([]byte{}, x...)
	})(o)
}

type OutsideCurrencyCode string

func (o OutsideCurrencyCode) DeepCopy() OutsideCurrencyCode {
	return o
}

type Asset struct {
	Type               string `codec:"type" json:"type"`
	Code               string `codec:"code" json:"code"`
	Issuer             string `codec:"issuer" json:"issuer"`
	VerifiedDomain     string `codec:"verifiedDomain" json:"verifiedDomain"`
	IssuerName         string `codec:"issuerName" json:"issuerName"`
	Desc               string `codec:"desc" json:"desc"`
	InfoUrl            string `codec:"infoUrl" json:"infoUrl"`
	InfoUrlText        string `codec:"infoUrlText" json:"infoUrlText"`
	ShowDepositButton  bool   `codec:"showDepositButton" json:"showDepositButton"`
	DepositButtonText  string `codec:"depositButtonText" json:"depositButtonText"`
	ShowWithdrawButton bool   `codec:"showWithdrawButton" json:"showWithdrawButton"`
	WithdrawButtonText string `codec:"withdrawButtonText" json:"withdrawButtonText"`
	WithdrawType       string `codec:"withdrawType" json:"withdrawType"`
	TransferServer     string `codec:"transferServer" json:"transferServer"`
	AuthEndpoint       string `codec:"authEndpoint" json:"authEndpoint"`
	DepositReqAuth     bool   `codec:"depositReqAuth" json:"depositReqAuth"`
	WithdrawReqAuth    bool   `codec:"withdrawReqAuth" json:"withdrawReqAuth"`
	UseSep24           bool   `codec:"useSep24" json:"useSep24"`
}

func (o Asset) DeepCopy() Asset {
	return Asset{
		Type:               o.Type,
		Code:               o.Code,
		Issuer:             o.Issuer,
		VerifiedDomain:     o.VerifiedDomain,
		IssuerName:         o.IssuerName,
		Desc:               o.Desc,
		InfoUrl:            o.InfoUrl,
		InfoUrlText:        o.InfoUrlText,
		ShowDepositButton:  o.ShowDepositButton,
		DepositButtonText:  o.DepositButtonText,
		ShowWithdrawButton: o.ShowWithdrawButton,
		WithdrawButtonText: o.WithdrawButtonText,
		WithdrawType:       o.WithdrawType,
		TransferServer:     o.TransferServer,
		AuthEndpoint:       o.AuthEndpoint,
		DepositReqAuth:     o.DepositReqAuth,
		WithdrawReqAuth:    o.WithdrawReqAuth,
		UseSep24:           o.UseSep24,
	}
}

type Balance struct {
	Asset        Asset  `codec:"asset" json:"asset"`
	Amount       string `codec:"amount" json:"amount"`
	Limit        string `codec:"limit" json:"limit"`
	IsAuthorized bool   `codec:"isAuthorized" json:"isAuthorized"`
}

func (o Balance) DeepCopy() Balance {
	return Balance{
		Asset:        o.Asset.DeepCopy(),
		Amount:       o.Amount,
		Limit:        o.Limit,
		IsAuthorized: o.IsAuthorized,
	}
}

type RequestStatus int

const (
	RequestStatus_OK       RequestStatus = 0
	RequestStatus_CANCELED RequestStatus = 1
	RequestStatus_DONE     RequestStatus = 2
)

func (o RequestStatus) DeepCopy() RequestStatus { return o }

var RequestStatusMap = map[string]RequestStatus{
	"OK":       0,
	"CANCELED": 1,
	"DONE":     2,
}

var RequestStatusRevMap = map[RequestStatus]string{
	0: "OK",
	1: "CANCELED",
	2: "DONE",
}

func (o RequestStatus) String() string {
	if v, ok := RequestStatusRevMap[o]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(o))
}

type AccountMode int

const (
	AccountMode_NONE   AccountMode = 0
	AccountMode_USER   AccountMode = 1
	AccountMode_MOBILE AccountMode = 2
)

func (o AccountMode) DeepCopy() AccountMode { return o }

var AccountModeMap = map[string]AccountMode{
	"NONE":   0,
	"USER":   1,
	"MOBILE": 2,
}

var AccountModeRevMap = map[AccountMode]string{
	0: "NONE",
	1: "USER",
	2: "MOBILE",
}

func (o AccountMode) String() string {
	if v, ok := AccountModeRevMap[o]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(o))
}

type CommonInterface interface {
}

func CommonProtocol(i CommonInterface) rpc.Protocol {
	return rpc.Protocol{
		Name:    "stellar.1.common",
		Methods: map[string]rpc.ServeHandlerDescription{},
	}
}

type CommonClient struct {
	Cli rpc.GenericClient
}
