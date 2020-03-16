// Auto-generated to Go types using avdl-compiler v1.4.6 (https://github.com/keybase/node-avdl-compiler)
//   Input file: ../client/protocol/avdl/keybase1/device.avdl

package keybase1

type DeviceDetail struct {
	Device          Device  `codec:"device" json:"device"`
	Eldest          bool    `codec:"eldest" json:"eldest"`
	Provisioner     *Device `codec:"provisioner,omitempty" json:"provisioner,omitempty"`
	ProvisionedAt   *Time   `codec:"provisionedAt,omitempty" json:"provisionedAt,omitempty"`
	RevokedAt       *Time   `codec:"revokedAt,omitempty" json:"revokedAt,omitempty"`
	RevokedBy       KID     `codec:"revokedBy" json:"revokedBy"`
	RevokedByDevice *Device `codec:"revokedByDevice,omitempty" json:"revokedByDevice,omitempty"`
	CurrentDevice   bool    `codec:"currentDevice" json:"currentDevice"`
}

func (o DeviceDetail) DeepCopy() DeviceDetail {
	return DeviceDetail{
		Device: o.Device.DeepCopy(),
		Eldest: o.Eldest,
		Provisioner: (func(x *Device) *Device {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.Provisioner),
		ProvisionedAt: (func(x *Time) *Time {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.ProvisionedAt),
		RevokedAt: (func(x *Time) *Time {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RevokedAt),
		RevokedBy: o.RevokedBy.DeepCopy(),
		RevokedByDevice: (func(x *Device) *Device {
			if x == nil {
				return nil
			}
			tmp := (*x).DeepCopy()
			return &tmp
		})(o.RevokedByDevice),
		CurrentDevice: o.CurrentDevice,
	}
}
