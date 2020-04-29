// Auto-generated to Go types and interfaces using avdl-compiler v1.4.9 (https://github.com/keybase/node-avdl-compiler)
//   Input file: avdl/keybase1/prove_common.avdl

package keybase1

import (
	"fmt"
	"github.com/keybase/go-framed-msgpack-rpc/rpc"
)

type ProofState int

const (
	ProofState_NONE             ProofState = 0
	ProofState_OK               ProofState = 1
	ProofState_TEMP_FAILURE     ProofState = 2
	ProofState_PERM_FAILURE     ProofState = 3
	ProofState_LOOKING          ProofState = 4
	ProofState_SUPERSEDED       ProofState = 5
	ProofState_POSTED           ProofState = 6
	ProofState_REVOKED          ProofState = 7
	ProofState_DELETED          ProofState = 8
	ProofState_UNKNOWN_TYPE     ProofState = 9
	ProofState_SIG_HINT_MISSING ProofState = 10
	ProofState_UNCHECKED        ProofState = 11
)

func (o ProofState) DeepCopy() ProofState { return o }

var ProofStateMap = map[string]ProofState{
	"NONE":             0,
	"OK":               1,
	"TEMP_FAILURE":     2,
	"PERM_FAILURE":     3,
	"LOOKING":          4,
	"SUPERSEDED":       5,
	"POSTED":           6,
	"REVOKED":          7,
	"DELETED":          8,
	"UNKNOWN_TYPE":     9,
	"SIG_HINT_MISSING": 10,
	"UNCHECKED":        11,
}

var ProofStateRevMap = map[ProofState]string{
	0:  "NONE",
	1:  "OK",
	2:  "TEMP_FAILURE",
	3:  "PERM_FAILURE",
	4:  "LOOKING",
	5:  "SUPERSEDED",
	6:  "POSTED",
	7:  "REVOKED",
	8:  "DELETED",
	9:  "UNKNOWN_TYPE",
	10: "SIG_HINT_MISSING",
	11: "UNCHECKED",
}

func (e ProofState) String() string {
	if v, ok := ProofStateRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

// 3: It's been found in the hunt, but not proven yet
// 1xx: Retryable soft errors; note that this will be put in the proof_cache, but won't
// be returned from the proof cache in most cases. Their freshness will always be
// RANCID.
// 2xx: Will likely result in a hard error, if repeated enough
// 3xx: Hard final errors
type ProofStatus int

const (
	ProofStatus_NONE              ProofStatus = 0
	ProofStatus_OK                ProofStatus = 1
	ProofStatus_LOCAL             ProofStatus = 2
	ProofStatus_FOUND             ProofStatus = 3
	ProofStatus_BASE_ERROR        ProofStatus = 100
	ProofStatus_HOST_UNREACHABLE  ProofStatus = 101
	ProofStatus_PERMISSION_DENIED ProofStatus = 103
	ProofStatus_FAILED_PARSE      ProofStatus = 106
	ProofStatus_DNS_ERROR         ProofStatus = 107
	ProofStatus_AUTH_FAILED       ProofStatus = 108
	ProofStatus_HTTP_429          ProofStatus = 129
	ProofStatus_HTTP_500          ProofStatus = 150
	ProofStatus_TIMEOUT           ProofStatus = 160
	ProofStatus_INTERNAL_ERROR    ProofStatus = 170
	ProofStatus_UNCHECKED         ProofStatus = 171
	ProofStatus_MISSING_PVL       ProofStatus = 172
	ProofStatus_BASE_HARD_ERROR   ProofStatus = 200
	ProofStatus_NOT_FOUND         ProofStatus = 201
	ProofStatus_CONTENT_FAILURE   ProofStatus = 202
	ProofStatus_BAD_USERNAME      ProofStatus = 203
	ProofStatus_BAD_REMOTE_ID     ProofStatus = 204
	ProofStatus_TEXT_NOT_FOUND    ProofStatus = 205
	ProofStatus_BAD_ARGS          ProofStatus = 206
	ProofStatus_CONTENT_MISSING   ProofStatus = 207
	ProofStatus_TITLE_NOT_FOUND   ProofStatus = 208
	ProofStatus_SERVICE_ERROR     ProofStatus = 209
	ProofStatus_TOR_SKIPPED       ProofStatus = 210
	ProofStatus_TOR_INCOMPATIBLE  ProofStatus = 211
	ProofStatus_HTTP_300          ProofStatus = 230
	ProofStatus_HTTP_400          ProofStatus = 240
	ProofStatus_HTTP_OTHER        ProofStatus = 260
	ProofStatus_EMPTY_JSON        ProofStatus = 270
	ProofStatus_DELETED           ProofStatus = 301
	ProofStatus_SERVICE_DEAD      ProofStatus = 302
	ProofStatus_BAD_SIGNATURE     ProofStatus = 303
	ProofStatus_BAD_API_URL       ProofStatus = 304
	ProofStatus_UNKNOWN_TYPE      ProofStatus = 305
	ProofStatus_NO_HINT           ProofStatus = 306
	ProofStatus_BAD_HINT_TEXT     ProofStatus = 307
	ProofStatus_INVALID_PVL       ProofStatus = 308
)

func (o ProofStatus) DeepCopy() ProofStatus { return o }

var ProofStatusMap = map[string]ProofStatus{
	"NONE":              0,
	"OK":                1,
	"LOCAL":             2,
	"FOUND":             3,
	"BASE_ERROR":        100,
	"HOST_UNREACHABLE":  101,
	"PERMISSION_DENIED": 103,
	"FAILED_PARSE":      106,
	"DNS_ERROR":         107,
	"AUTH_FAILED":       108,
	"HTTP_429":          129,
	"HTTP_500":          150,
	"TIMEOUT":           160,
	"INTERNAL_ERROR":    170,
	"UNCHECKED":         171,
	"MISSING_PVL":       172,
	"BASE_HARD_ERROR":   200,
	"NOT_FOUND":         201,
	"CONTENT_FAILURE":   202,
	"BAD_USERNAME":      203,
	"BAD_REMOTE_ID":     204,
	"TEXT_NOT_FOUND":    205,
	"BAD_ARGS":          206,
	"CONTENT_MISSING":   207,
	"TITLE_NOT_FOUND":   208,
	"SERVICE_ERROR":     209,
	"TOR_SKIPPED":       210,
	"TOR_INCOMPATIBLE":  211,
	"HTTP_300":          230,
	"HTTP_400":          240,
	"HTTP_OTHER":        260,
	"EMPTY_JSON":        270,
	"DELETED":           301,
	"SERVICE_DEAD":      302,
	"BAD_SIGNATURE":     303,
	"BAD_API_URL":       304,
	"UNKNOWN_TYPE":      305,
	"NO_HINT":           306,
	"BAD_HINT_TEXT":     307,
	"INVALID_PVL":       308,
}

var ProofStatusRevMap = map[ProofStatus]string{
	0:   "NONE",
	1:   "OK",
	2:   "LOCAL",
	3:   "FOUND",
	100: "BASE_ERROR",
	101: "HOST_UNREACHABLE",
	103: "PERMISSION_DENIED",
	106: "FAILED_PARSE",
	107: "DNS_ERROR",
	108: "AUTH_FAILED",
	129: "HTTP_429",
	150: "HTTP_500",
	160: "TIMEOUT",
	170: "INTERNAL_ERROR",
	171: "UNCHECKED",
	172: "MISSING_PVL",
	200: "BASE_HARD_ERROR",
	201: "NOT_FOUND",
	202: "CONTENT_FAILURE",
	203: "BAD_USERNAME",
	204: "BAD_REMOTE_ID",
	205: "TEXT_NOT_FOUND",
	206: "BAD_ARGS",
	207: "CONTENT_MISSING",
	208: "TITLE_NOT_FOUND",
	209: "SERVICE_ERROR",
	210: "TOR_SKIPPED",
	211: "TOR_INCOMPATIBLE",
	230: "HTTP_300",
	240: "HTTP_400",
	260: "HTTP_OTHER",
	270: "EMPTY_JSON",
	301: "DELETED",
	302: "SERVICE_DEAD",
	303: "BAD_SIGNATURE",
	304: "BAD_API_URL",
	305: "UNKNOWN_TYPE",
	306: "NO_HINT",
	307: "BAD_HINT_TEXT",
	308: "INVALID_PVL",
}

func (e ProofStatus) String() string {
	if v, ok := ProofStatusRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type ProofType int

const (
	ProofType_NONE             ProofType = 0
	ProofType_KEYBASE          ProofType = 1
	ProofType_TWITTER          ProofType = 2
	ProofType_GITHUB           ProofType = 3
	ProofType_REDDIT           ProofType = 4
	ProofType_COINBASE         ProofType = 5
	ProofType_HACKERNEWS       ProofType = 6
	ProofType_FACEBOOK         ProofType = 8
	ProofType_GENERIC_SOCIAL   ProofType = 9
	ProofType_GENERIC_WEB_SITE ProofType = 1000
	ProofType_DNS              ProofType = 1001
	ProofType_PGP              ProofType = 1002
	ProofType_ROOTER           ProofType = 100001
)

func (o ProofType) DeepCopy() ProofType { return o }

var ProofTypeMap = map[string]ProofType{
	"NONE":             0,
	"KEYBASE":          1,
	"TWITTER":          2,
	"GITHUB":           3,
	"REDDIT":           4,
	"COINBASE":         5,
	"HACKERNEWS":       6,
	"FACEBOOK":         8,
	"GENERIC_SOCIAL":   9,
	"GENERIC_WEB_SITE": 1000,
	"DNS":              1001,
	"PGP":              1002,
	"ROOTER":           100001,
}

var ProofTypeRevMap = map[ProofType]string{
	0:      "NONE",
	1:      "KEYBASE",
	2:      "TWITTER",
	3:      "GITHUB",
	4:      "REDDIT",
	5:      "COINBASE",
	6:      "HACKERNEWS",
	8:      "FACEBOOK",
	9:      "GENERIC_SOCIAL",
	1000:   "GENERIC_WEB_SITE",
	1001:   "DNS",
	1002:   "PGP",
	100001: "ROOTER",
}

func (e ProofType) String() string {
	if v, ok := ProofTypeRevMap[e]; ok {
		return v
	}
	return fmt.Sprintf("%v", int(e))
}

type SelectorEntry struct {
	IsIndex    bool   `codec:"isIndex" json:"isIndex"`
	Index      int    `codec:"index" json:"index"`
	IsKey      bool   `codec:"isKey" json:"isKey"`
	Key        string `codec:"key" json:"key"`
	IsAll      bool   `codec:"isAll" json:"isAll"`
	IsContents bool   `codec:"isContents" json:"isContents"`
}

func (o SelectorEntry) DeepCopy() SelectorEntry {
	return SelectorEntry{
		IsIndex:    o.IsIndex,
		Index:      o.Index,
		IsKey:      o.IsKey,
		Key:        o.Key,
		IsAll:      o.IsAll,
		IsContents: o.IsContents,
	}
}

type ParamProofJSON struct {
	SigHash    SigID  `codec:"sigHash" json:"sig_hash"`
	KbUsername string `codec:"kbUsername" json:"kb_username"`
}

func (o ParamProofJSON) DeepCopy() ParamProofJSON {
	return ParamProofJSON{
		SigHash:    o.SigHash.DeepCopy(),
		KbUsername: o.KbUsername,
	}
}

type ParamProofUsernameConfig struct {
	Re  string `codec:"re" json:"re"`
	Min int    `codec:"min" json:"min"`
	Max int    `codec:"max" json:"max"`
}

func (o ParamProofUsernameConfig) DeepCopy() ParamProofUsernameConfig {
	return ParamProofUsernameConfig{
		Re:  o.Re,
		Min: o.Min,
		Max: o.Max,
	}
}

type ParamProofServiceConfig struct {
	Version        int                      `codec:"version" json:"version"`
	Domain         string                   `codec:"domain" json:"domain"`
	DisplayName    string                   `codec:"displayName" json:"display_name"`
	Description    string                   `codec:"description" json:"description"`
	UsernameConfig ParamProofUsernameConfig `codec:"usernameConfig" json:"username"`
	BrandColor     string                   `codec:"brandColor" json:"brand_color"`
	PrefillUrl     string                   `codec:"prefillUrl" json:"prefill_url"`
	ProfileUrl     string                   `codec:"profileUrl" json:"profile_url"`
	CheckUrl       string                   `codec:"checkUrl" json:"check_url"`
	CheckPath      []SelectorEntry          `codec:"checkPath" json:"check_path"`
	AvatarPath     []SelectorEntry          `codec:"avatarPath" json:"avatar_path"`
}

func (o ParamProofServiceConfig) DeepCopy() ParamProofServiceConfig {
	return ParamProofServiceConfig{
		Version:        o.Version,
		Domain:         o.Domain,
		DisplayName:    o.DisplayName,
		Description:    o.Description,
		UsernameConfig: o.UsernameConfig.DeepCopy(),
		BrandColor:     o.BrandColor,
		PrefillUrl:     o.PrefillUrl,
		ProfileUrl:     o.ProfileUrl,
		CheckUrl:       o.CheckUrl,
		CheckPath: (func(x []SelectorEntry) []SelectorEntry {
			if x == nil {
				return nil
			}
			ret := make([]SelectorEntry, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.CheckPath),
		AvatarPath: (func(x []SelectorEntry) []SelectorEntry {
			if x == nil {
				return nil
			}
			ret := make([]SelectorEntry, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.AvatarPath),
	}
}

type ServiceDisplayConfig struct {
	CreationDisabled bool    `codec:"creationDisabled" json:"creation_disabled"`
	Priority         int     `codec:"priority" json:"priority"`
	Key              string  `codec:"key" json:"key"`
	Group            *string `codec:"group,omitempty" json:"group,omitempty"`
	New              bool    `codec:"new" json:"new"`
	LogoKey          string  `codec:"logoKey" json:"logo_key"`
}

func (o ServiceDisplayConfig) DeepCopy() ServiceDisplayConfig {
	return ServiceDisplayConfig{
		CreationDisabled: o.CreationDisabled,
		Priority:         o.Priority,
		Key:              o.Key,
		Group: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Group),
		New:     o.New,
		LogoKey: o.LogoKey,
	}
}

type ExternalServiceConfig struct {
	SchemaVersion int                      `codec:"schemaVersion" json:"schema_version"`
	Display       *ServiceDisplayConfig    `codec:"display,omitempty" json:"display,omitempty"`
	Config        *ParamProofServiceConfig `codec:"config,omitempty" json:"config,omitempty"`
}

func (o ExternalServiceConfig) DeepCopy() ExternalServiceConfig {
	return ExternalServiceConfig{
		SchemaVersion: o.SchemaVersion,
		Display: (func(x *ServiceDisplayConfig) *ServiceDisplayConfig {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Display),
		Config: (func(x *ParamProofServiceConfig) *ParamProofServiceConfig {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Config),
	}
}

type ProveCommonInterface interface {
}

func ProveCommonProtocol(i ProveCommonInterface) rpc.Protocol {
	return rpc.Protocol{
		Name:    "keybase.1.proveCommon",
		Methods: map[string]rpc.ServeHandlerDescription{},
	}
}

type ProveCommonClient struct {
	Cli rpc.GenericClient
}
