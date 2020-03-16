// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/test.avdl

package keybase1

// Result from calling test(..).
type Test struct {
	Reply string `codec:"reply" json:"reply"`
}

func (o Test) DeepCopy() Test {
	return Test{
		Reply: o.Reply,
	}
}

type Generic struct {
	M map[string]Generic `codec:"m" json:"m"`
	A []Generic          `codec:"a" json:"a"`
	S *string            `codec:"s,omitempty" json:"s,omitempty"`
	I *int               `codec:"i,omitempty" json:"i,omitempty"`
}

func (o Generic) DeepCopy() Generic {
	return Generic{
		M: (func(x map[string]Generic) map[string]Generic {
			if x == nil {
				return nil
			}
			ret := make(map[string]Generic, len(x))
			for k, v := range x {
				kCopy := k
				vCopy := v.DeepCopy()
				ret[kCopy] = vCopy
			}
			return ret
		})(o.M),
		A: (func(x []Generic) []Generic {
			if x == nil {
				return nil
			}
			ret := make([]Generic, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.A),
		S: (func(x *string) *string {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.S),
		I: (func(x *int) *int {
			if x == nil {
				return nil
			}
			tmp := (*x)
			return &tmp
		})(o.I),
	}
}
