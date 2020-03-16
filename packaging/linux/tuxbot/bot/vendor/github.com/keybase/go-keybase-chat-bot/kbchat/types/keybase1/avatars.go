// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/avatars.avdl

package keybase1

type AvatarUrl string

func (o AvatarUrl) DeepCopy() AvatarUrl {
	return o
}

type AvatarFormat string

func (o AvatarFormat) DeepCopy() AvatarFormat {
	return o
}

type LoadAvatarsRes struct {
	Picmap map[string]map[AvatarFormat]AvatarUrl `codec:"picmap" json:"picmap"`
}

func (o LoadAvatarsRes) DeepCopy() LoadAvatarsRes {
	return LoadAvatarsRes{
		Picmap: (func(x map[string]map[AvatarFormat]AvatarUrl) map[string]map[AvatarFormat]AvatarUrl {
			if x == nil {
				return nil
			}
			ret := make(map[string]map[AvatarFormat]AvatarUrl, len(x))
			for k, v := range x {
				kCopy := k
				vCopy := (func(x map[AvatarFormat]AvatarUrl) map[AvatarFormat]AvatarUrl {
					if x == nil {
						return nil
					}
					ret := make(map[AvatarFormat]AvatarUrl, len(x))
					for k, v := range x {
						kCopy := k.DeepCopy()
						vCopy := v.DeepCopy()
						ret[kCopy] = vCopy
					}
					return ret
				})(v)
				ret[kCopy] = vCopy
			}
			return ret
		})(o.Picmap),
	}
}

type AvatarClearCacheMsg struct {
	Name    string           `codec:"name" json:"name"`
	Formats []AvatarFormat   `codec:"formats" json:"formats"`
	Typ     AvatarUpdateType `codec:"typ" json:"typ"`
}

func (o AvatarClearCacheMsg) DeepCopy() AvatarClearCacheMsg {
	return AvatarClearCacheMsg{
		Name: o.Name,
		Formats: (func(x []AvatarFormat) []AvatarFormat {
			if x == nil {
				return nil
			}
			ret := make([]AvatarFormat, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Formats),
		Typ: o.Typ.DeepCopy(),
	}
}
