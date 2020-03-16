// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/apiserver.avdl

package keybase1

type APIRes struct {
	Status     string `codec:"status" json:"status"`
	Body       string `codec:"body" json:"body"`
	HttpStatus int    `codec:"httpStatus" json:"httpStatus"`
	AppStatus  string `codec:"appStatus" json:"appStatus"`
}

func (o APIRes) DeepCopy() APIRes {
	return APIRes{
		Status:     o.Status,
		Body:       o.Body,
		HttpStatus: o.HttpStatus,
		AppStatus:  o.AppStatus,
	}
}
