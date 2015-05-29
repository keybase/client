package libkbfs

import (
	"fmt"

	keybase1 "github.com/keybase/client/protocol/go"
)

// MDOpsStandard provides plaintext RootMetadata objects to upper
// layers, and processes RootMetadataSigned objects (encrypted and
// signed) suitable for passing to/from the MDServer backend.
type MDOpsStandard struct {
	config Config
}

func (md *MDOpsStandard) processMetadata(
	handle *DirHandle, rmds *RootMetadataSigned) error {
	crypto := md.config.Crypto()
	codec := md.config.Codec()
	// verify signature and deserialize root data, if the sig is not blank.
	// a blank sig means this is a brand new MD object, nothing to check
	if rmds.IsInitialized() {
		// decrypt the root data for non-public directories
		if !handle.IsPublic() {
			path := Path{rmds.MD.ID, []PathNode{}}
			k, err := md.config.KeyManager().GetTLFCryptKey(path, &rmds.MD)
			if err != nil {
				return err
			}
			databuf, err := crypto.DecryptPrivateMetadata(rmds.MD.SerializedPrivateMetadata, k)
			if err != nil {
				return err
			}
			if err := codec.Decode(databuf, &rmds.MD.data); err != nil {
				return err
			}
		} else if err := codec.Decode(
			rmds.MD.SerializedPrivateMetadata, &rmds.MD.data); err != nil {
			return err
		}

		// Make sure the last writer is really a valid writer
		writer := rmds.MD.data.LastWriter
		if !handle.IsWriter(writer) {
			return &MDMismatchError{
				handle.ToString(md.config),
				fmt.Sprintf("MD (id=%s) was written by a non-writer %s",
					rmds.MD.ID, writer)}
		}

		// TODO:
		// Both of these have to happen after decryption so
		// we can see who the last writer was.
		kbpki := md.config.KBPKI()
		me, err := kbpki.GetLoggedInUser()
		if err != nil {
			return err
		}

		// re-marshal the metadata
		// TODO: can we somehow avoid the re-marshaling by saving the
		// marshalled metadata somewhere?
		var buf []byte
		if buf, err = codec.Encode(rmds.MD); err != nil {
			return err
		}

		if handle.IsPrivateShare() {
			// For private shares:
			//   * Get MAC public key of last writer
			//   * Get shared secret with our private MAC key
			//   * Verify using MAC
			if mac, ok := rmds.Macs[me]; !ok {
				return &MDMismatchError{
					handle.ToString(md.config),
					fmt.Sprintf("MD (id=%s) is a private share but doesn't "+
						"contain a key for my logged in user (%s)",
						rmds.MD.ID, me)}
				// TODO: figure out the right kid for the writer, should
				// be in the mac somewhere
			} else if pubKey, err := md.config.KeyOps().GetMacPublicKey(
				writer); err != nil {
				return err
			} else if err := crypto.VerifyMAC(pubKey, buf, mac); err != nil {
				return err
			}
		} else {
			// For any home or public directory:
			//   * Verify normally using the user's public key matching the verifying key KID.
			// TODO: what do we do if the signature is from a revoked
			// key?
			err = kbpki.HasVerifyingKey(writer, rmds.SigInfo.VerifyingKey)
			if err != nil {
				return err
			}

			err = crypto.Verify(buf, rmds.SigInfo)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

// GetAtHandle implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) GetAtHandle(handle *DirHandle) (*RootMetadata, error) {
	mdserv := md.config.MDServer()
	if rmds, err := mdserv.GetAtHandle(handle); err != nil {
		return nil, err
	} else if err := md.processMetadata(handle, rmds); err != nil {
		return nil, err
	} else {
		if rmds.IsInitialized() {
			// Make the the signed-over UIDs in the latest Keys match the handle
			handleString := handle.ToString(md.config)
			fetchedHandleString := rmds.MD.GetDirHandle().ToString(md.config)
			if fetchedHandleString != handleString {
				return nil, &MDMismatchError{
					handleString,
					fmt.Sprintf("MD (id=%s) contained unexpected handle %s",
						rmds.MD.ID, fetchedHandleString)}
			}
		}
		return &rmds.MD, nil
	}
}

// Get implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) Get(id DirID) (*RootMetadata, error) {
	mdserv := md.config.MDServer()
	rmds, err := mdserv.Get(id)
	if err != nil {
		return nil, err
	}

	// Make sure the signed-over ID matches
	if id != rmds.MD.ID {
		return nil, &MDMismatchError{
			id.String(),
			fmt.Sprintf("MD contained unexpected id %s",
				rmds.MD.ID.String())}
	}
	return &rmds.MD, md.processMetadata(rmds.MD.GetDirHandle(), rmds)
}

// GetAtID implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) GetAtID(id DirID, mdID MdID) (
	*RootMetadata, error) {
	// TODO: implement a cache for non-current MD
	rmds, err := md.config.MDServer().GetAtID(id, mdID)
	if err == nil {
		// TODO: validate and process MD
		return &rmds.MD, err
	}
	return nil, err
}

// Put implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) Put(id DirID, rmd *RootMetadata) error {
	me, err := md.config.KBPKI().GetLoggedInUser()
	if err != nil {
		return err
	}
	rmd.data.LastWriter = me

	// First encode (and maybe encrypt) the root data
	codec := md.config.Codec()
	databuf, err := codec.Encode(rmd.data)
	if err != nil {
		return err
	}
	crypto := md.config.Crypto()
	if !id.IsPublic() {
		path := Path{rmd.ID, []PathNode{}}
		rk, err := md.config.KeyManager().GetTLFCryptKey(path, rmd)
		if err != nil {
			return err
		}
		rmd.SerializedPrivateMetadata, err = crypto.EncryptPrivateMetadata(databuf, rk)
		if err != nil {
			return err
		}
	} else {
		rmd.SerializedPrivateMetadata = databuf
	}

	// encode the metadata and sign it
	buf, err := codec.Encode(rmd)
	if err != nil {
		return err
	}

	handle := rmd.GetDirHandle()
	rmds := &RootMetadataSigned{}
	rmds.MD = *rmd
	if handle.IsPrivateShare() {
		// For private shares:
		//   * For each reader/writer:
		//     - Get MAC public key
		//     - Get shared secret with our private MAC key
		//     - Sign using MAC
		rmds.Macs = make(map[keybase1.UID][]byte)
		macFunc := func(user keybase1.UID) error {
			// use the latest mac keys
			if pubKey, err := md.config.KeyOps().GetMacPublicKey(user); err != nil {
				return err
			} else if mac, err := crypto.MAC(pubKey, buf); err != nil {
				return err
			} else {
				rmds.Macs[user] = mac
			}
			return nil
		}

		for _, w := range handle.Writers {
			if err := macFunc(w); err != nil {
				return err
			}
		}
		for _, r := range handle.Readers {
			if err := macFunc(r); err != nil {
				return err
			}
		}
	} else {
		// For our home and public directory:
		//   * Sign normally using the local device private key
		sigInfo, err := crypto.Sign(buf)
		if err != nil {
			return err
		}
		rmds.SigInfo = sigInfo
	}

	mdID, err := rmd.MetadataID(md.config)
	if err != nil {
		return err
	}
	return md.config.MDServer().Put(id, mdID, rmds)
}

// GetFavorites implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) GetFavorites() ([]DirID, error) {
	mdserv := md.config.MDServer()
	return mdserv.GetFavorites()
}
