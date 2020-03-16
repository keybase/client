// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/account.avdl

package keybase1

type HasServerKeysRes struct {
	HasServerKeys bool `codec:"hasServerKeys" json:"hasServerKeys"`
}

func (o HasServerKeysRes) DeepCopy() HasServerKeysRes {
	return HasServerKeysRes{
		HasServerKeys: o.HasServerKeys,
	}
}

type LockdownHistory struct {
	Status       bool     `codec:"status" json:"status"`
	CreationTime Time     `codec:"creationTime" json:"ctime"`
	DeviceID     DeviceID `codec:"deviceID" json:"device_id"`
	DeviceName   string   `codec:"deviceName" json:"deviceName"`
}

func (o LockdownHistory) DeepCopy() LockdownHistory {
	return LockdownHistory{
		Status:       o.Status,
		CreationTime: o.CreationTime.DeepCopy(),
		DeviceID:     o.DeviceID.DeepCopy(),
		DeviceName:   o.DeviceName,
	}
}

type GetLockdownResponse struct {
	History []LockdownHistory `codec:"history" json:"history"`
	Status  bool              `codec:"status" json:"status"`
}

func (o GetLockdownResponse) DeepCopy() GetLockdownResponse {
	return GetLockdownResponse{
		History: (func(x []LockdownHistory) []LockdownHistory {
			if x == nil {
				return nil
			}
			ret := make([]LockdownHistory, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.History),
		Status: o.Status,
	}
}

type TeamContactSettings struct {
	TeamID  TeamID `codec:"teamID" json:"team_id"`
	Enabled bool   `codec:"enabled" json:"enabled"`
}

func (o TeamContactSettings) DeepCopy() TeamContactSettings {
	return TeamContactSettings{
		TeamID:  o.TeamID.DeepCopy(),
		Enabled: o.Enabled,
	}
}

type ContactSettings struct {
	Version              *int                  `codec:"version,omitempty" json:"version,omitempty"`
	AllowFolloweeDegrees int                   `codec:"allowFolloweeDegrees" json:"allow_followee_degrees"`
	AllowGoodTeams       bool                  `codec:"allowGoodTeams" json:"allow_good_teams"`
	Enabled              bool                  `codec:"enabled" json:"enabled"`
	Teams                []TeamContactSettings `codec:"teams" json:"teams"`
}

func (o ContactSettings) DeepCopy() ContactSettings {
	return ContactSettings{
		Version: (func(x *int) *int {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.Version),
		AllowFolloweeDegrees: o.AllowFolloweeDegrees,
		AllowGoodTeams:       o.AllowGoodTeams,
		Enabled:              o.Enabled,
		Teams: (func(x []TeamContactSettings) []TeamContactSettings {
			if x == nil {
				return nil
			}
			ret := make([]TeamContactSettings, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Teams),
	}
}
