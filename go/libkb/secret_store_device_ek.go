package libkb

import (
	"fmt"
	"strconv"
	"strings"
)

// TODO consolidate these types when deviceEK generation is merged
const EphemeralSeedLen = 32

type DeviceEphemeralSeed [EphemeralSeedLen]byte
type DeviceEKGeneration uint

type SecretStoreDeviceEK struct {
	username NormalizedUsername
	ss       *SecretStoreLocked
}

func NewSecretStoreDeviceEK(g *GlobalContext) *SecretStoreDeviceEK {
	return &SecretStoreDeviceEK{
		ss:       NewSecretStoreLocked(g),
		username: g.Env.GetUsername(),
	}
}

func newDeviceEphermeralSeedFromBytes(b []byte) (deviceSecret DeviceEphemeralSeed, err error) {
	if len(b) != EphemeralSeedLen {
		err = fmt.Errorf("Wrong EphemeralSeedLen len: %d != %d", len(b), EphemeralSeedLen)
		return deviceSecret, err
	}
	copy(deviceSecret[:], b)
	return deviceSecret, nil
}

func deviceEmphemeralSeedFromLKSecFullSecret(f LKSecFullSecret) (deviceSecret DeviceEphemeralSeed) {
	if f.f == nil {
		return deviceSecret
	}
	return DeviceEphemeralSeed(*f.f)
}

func deviceEmphemeralSeedToLKSecFullSecret(seed DeviceEphemeralSeed) (secret LKSecFullSecret, err error) {
	return newLKSecFullSecretFromBytes(seed[:])
}

func (s *SecretStoreDeviceEK) deviceEKPrefix() string {
	return fmt.Sprintf("%s-device-ephemeral-key-", s.username)
}

func (s *SecretStoreDeviceEK) deviceEKName(generation DeviceEKGeneration) NormalizedUsername {
	return NewNormalizedUsername(fmt.Sprintf("%s%d", s.deviceEKPrefix(), generation))
}

func (s *SecretStoreDeviceEK) RetrieveSecret(generation DeviceEKGeneration) (deviceSecret DeviceEphemeralSeed, err error) {
	name := s.deviceEKName(generation)
	secret, err := s.ss.RetrieveSecret(name)
	if err != nil {
		return deviceSecret, err
	}
	return deviceEmphemeralSeedFromLKSecFullSecret(secret), nil
}

func (s *SecretStoreDeviceEK) StoreSecret(generation DeviceEKGeneration, deviceSecret DeviceEphemeralSeed) (err error) {
	name := s.deviceEKName(generation)
	secret, err := deviceEmphemeralSeedToLKSecFullSecret(deviceSecret)
	if err != nil {
		return err
	}
	return s.ss.StoreSecret(name, secret)
}

func (s *SecretStoreDeviceEK) ClearSecret(generation DeviceEKGeneration) error {
	name := s.deviceEKName(generation)
	return s.ss.ClearSecret(name)
}

func (s *SecretStoreDeviceEK) getGenerations() (generations []DeviceEKGeneration, err error) {
	usernames, err := s.ss.GetUsersWithStoredSecrets()
	if err != nil {
		return generations, err
	}
	for _, username := range usernames {
		if strings.HasPrefix(username, s.deviceEKPrefix()) {
			parts := strings.Split(username, s.deviceEKPrefix())
			generation, err := strconv.ParseUint(parts[1], 10, 64)
			if err != nil {
				return generations, err
			}
			generations = append(generations, DeviceEKGeneration(generation))
		}
	}
	return generations, nil
}

func (s *SecretStoreDeviceEK) GetAllDeviceEKs() (deviceEKs map[DeviceEKGeneration]DeviceEphemeralSeed, err error) {
	deviceEKs = make(map[DeviceEKGeneration]DeviceEphemeralSeed)
	generations, err := s.getGenerations()
	if err != nil {
		return deviceEKs, err
	}
	for _, generation := range generations {
		secret, err := s.RetrieveSecret(generation)
		if err != nil {
			return deviceEKs, err
		}
		deviceEKs[generation] = secret
	}
	return deviceEKs, nil
}

func (s *SecretStoreDeviceEK) GetMaxGeneration() (maxGeneration DeviceEKGeneration, err error) {
	generations, err := s.getGenerations()
	if err != nil {
		return maxGeneration, err
	}
	for _, generation := range generations {
		if generation > maxGeneration {
			maxGeneration = generation
		}
	}
	return maxGeneration, nil
}
