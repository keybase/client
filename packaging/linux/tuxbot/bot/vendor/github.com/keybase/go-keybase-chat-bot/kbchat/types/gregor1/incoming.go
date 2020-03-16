// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/gregor1/incoming.avdl

package gregor1

type SyncResult struct {
	Msgs []InBandMessage `codec:"msgs" json:"msgs"`
	Hash []byte          `codec:"hash" json:"hash"`
}

func (o SyncResult) DeepCopy() SyncResult {
	return SyncResult{
		Msgs: (func(x []InBandMessage) []InBandMessage {
			if x == nil {
				return nil
			}
			ret := make([]InBandMessage, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Msgs),
		Hash: (func(x []byte) []byte {
			if x == nil {
				return nil
			}
			return append([]byte{}, x...)
		})(o.Hash),
	}
}

// DescribeConnectedUsers will take a list of users, and return the list of users
// which are connected to any Gregor in the cluster, and what devices (and device type)
// those users are connected with.
type ConnectedDevice struct {
	DeviceID       DeviceID `codec:"deviceID" json:"deviceID"`
	DeviceType     string   `codec:"deviceType" json:"deviceType"`
	DevicePlatform string   `codec:"devicePlatform" json:"devicePlatform"`
	UserAgent      string   `codec:"userAgent" json:"userAgent"`
}

func (o ConnectedDevice) DeepCopy() ConnectedDevice {
	return ConnectedDevice{
		DeviceID:       o.DeviceID.DeepCopy(),
		DeviceType:     o.DeviceType,
		DevicePlatform: o.DevicePlatform,
		UserAgent:      o.UserAgent,
	}
}

type ConnectedUser struct {
	Uid     UID               `codec:"uid" json:"uid"`
	Devices []ConnectedDevice `codec:"devices" json:"devices"`
}

func (o ConnectedUser) DeepCopy() ConnectedUser {
	return ConnectedUser{
		Uid: o.Uid.DeepCopy(),
		Devices: (func(x []ConnectedDevice) []ConnectedDevice {
			if x == nil {
				return nil
			}
			ret := make([]ConnectedDevice, len(x))
			for i, v := range x {
				vCopy := v.DeepCopy()
				ret[i] = vCopy
			}
			return ret
		})(o.Devices),
	}
}
