package libkb

import "context"

type deviceCheckedCachedOnlyKey struct{}

// WithDeviceCheckedCachedOnly marks a login whose device was checked against the cached user only,
// so the login hooks know to check it with the server.
func WithDeviceCheckedCachedOnly(ctx context.Context) context.Context {
	return context.WithValue(ctx, deviceCheckedCachedOnlyKey{}, true)
}

func DeviceCheckedCachedOnly(ctx context.Context) bool {
	v, _ := ctx.Value(deviceCheckedCachedOnlyKey{}).(bool)
	return v
}
