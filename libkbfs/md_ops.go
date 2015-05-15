package libkbfs

import (
	"fmt"

	libkb "github.com/keybase/client/go/libkb"
)

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
			path := Path{rmds.MD.Id, []PathNode{}}
			k, err := md.config.KeyManager().GetSecretKey(path, &rmds.MD)
			if err != nil {
				return err
			}
			databuf, err := crypto.Decrypt(rmds.MD.SerializedPrivateMetadata, k)
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
					rmds.MD.Id, writer)}
		}

		// TODO:
		// Both of these have to happen after decryption so
		// we can see who the last writer was.
		kops := md.config.KeyOps()
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
			//   * Get HMAC public key of last writer
			//   * Get shared secret with our private HMAC key
			//   * Verify using HMAC
			if hmac, ok := rmds.Macs[me]; !ok {
				return &MDMismatchError{
					handle.ToString(md.config),
					fmt.Sprintf("MD (id=%s) is a private share but doesn't "+
						"contain a key for my logged in user (%s)",
						rmds.MD.Id, me)}
				// TODO: figure out the right kid for the writer, should
				// be in the hmac somewhere
			} else if pubKey, err := kops.GetPublicMacKey(
				writer, nil); err != nil {
				return err
				// TODO: again, figure out the right kid here
			} else if privKey, err := kops.GetMyPrivateMacKey(nil); err != nil {
				return err
			} else if secret, err := crypto.SharedSecret(
				privKey, pubKey); err != nil {
				return err
			} else if err := crypto.VerifyHMAC(secret, buf, hmac); err != nil {
				return err
			}
		} else {
			// For any home or public directory:
			//   * Verify normally using the user's public key
			// TODO: what do we do if the signature is from a revoked
			// key?
			if user, err := kbpki.GetUser(writer); err != nil {
				return err
			} else if key, err := kbpki.GetPublicSigningKey(user); err != nil {
				return err
			} else if err := crypto.Verify(rmds.Sig, buf, key); err != nil {
				return err
			}
		}

		// Since we don't do conflict resolution yet, we don't care
		// about block changes when we're reading in the MD from the
		// server.  TODO: remove this once KBFSOps starts properly
		// doing copy-on-write for metadata.
		rmds.MD.ClearBlockChanges()
	}
	return nil
}

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
						rmds.MD.Id, fetchedHandleString)}
			}
		}
		return &rmds.MD, nil
	}
}

func (md *MDOpsStandard) Get(id DirId) (*RootMetadata, error) {
	mdserv := md.config.MDServer()
	if rmds, err := mdserv.Get(id); err != nil {
		return nil, err
	} else {
		// Make sure the signed-over ID matches
		if id != rmds.MD.Id {
			return nil, &MDMismatchError{
				id.String(),
				fmt.Sprintf("MD contained unexpected id %s",
					rmds.MD.Id.String())}
		}
		return &rmds.MD, md.processMetadata(rmds.MD.GetDirHandle(), rmds)
	}
}

func (md *MDOpsStandard) GetAtId(id DirId, mdId MDId) (
	*RootMetadata, error) {
	// TODO: implement a cache for non-current MD
	if rmds, err := md.config.MDServer().GetAtId(id, mdId); err == nil {
		// TODO: validate and process MD
		return &rmds.MD, err
	} else {
		return nil, err
	}
}

func (md *MDOpsStandard) Put(id DirId, rmd *RootMetadata) error {
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
		// TODO: do we need a server-side key half for the encrypted
		// metadata?
		path := Path{rmd.Id, []PathNode{}}
		rk, err := md.config.KeyManager().GetSecretKey(path, rmd)
		if err != nil {
			return err
		}
		rmd.SerializedPrivateMetadata, err = crypto.Encrypt(databuf, rk)
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
		//     - Get HMAC public key
		//     - Get shared secret with our private HMAC key
		//     - Sign using HMAC
		kops := md.config.KeyOps()
		privKey, err := kops.GetMyPrivateMacKey(nil)
		if err != nil {
			return err
		}

		rmds.Macs = make(map[libkb.UID][]byte)
		hmacFunc := func(user libkb.UID) error {
			// use the latest mac keys
			if pubKey, err := kops.GetPublicMacKey(user, nil); err != nil {
				return err
			} else if secret, err := crypto.SharedSecret(
				privKey, pubKey); err != nil {
				return err
			} else if hmac, err := crypto.HMAC(secret, buf); err != nil {
				return err
			} else {
				rmds.Macs[user] = hmac
			}
			return nil
		}

		for _, w := range handle.Writers {
			if err := hmacFunc(w); err != nil {
				return err
			}
		}
		for _, r := range handle.Readers {
			if err := hmacFunc(r); err != nil {
				return err
			}
		}
	} else {
		// For our home and public directory:
		//   * Sign normally using the local device private key
		sig, err := crypto.Sign(buf)
		if err != nil {
			return err
		}
		rmds.Sig = sig
	}

	mdId, err := rmd.MetadataId(md.config)
	if err != nil {
		return err
	}
	return md.config.MDServer().Put(id, mdId, rmds)
}

func (md *MDOpsStandard) GetFavorites() ([]DirId, error) {
	mdserv := md.config.MDServer()
	return mdserv.GetFavorites()
}
