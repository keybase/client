// +build !production,darwin

package libkb

// Keep this value small in devel, it's expensive in tests.
const maxKeychainItemSlots = 2
