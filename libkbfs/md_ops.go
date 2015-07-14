package libkbfs

import (
	"fmt"

	keybase1 "github.com/keybase/client/protocol/go"
	"golang.org/x/net/context"
)

// MDOpsStandard provides plaintext RootMetadata objects to upper
// layers, and processes RootMetadataSigned objects (encrypted and
// signed) suitable for passing to/from the MDServer backend.
type MDOpsStandard struct {
	config Config
}

func (md *MDOpsStandard) processMetadata(ctx context.Context,
	handle *TlfHandle, rmds *RootMetadataSigned) error {
	crypto := md.config.Crypto()
	codec := md.config.Codec()
	// verify signature and deserialize root data, if the sig is not blank.
	// a blank sig means this is a brand new MD object, nothing to check
	if rmds.IsInitialized() {
		if handle.IsPublic() {
			if err := codec.Decode(rmds.MD.SerializedPrivateMetadata, &rmds.MD.data); err != nil {
				return err
			}
		} else {
			// decrypt the root data for non-public directories
			var encryptedPrivateMetadata EncryptedPrivateMetadata
			if err := codec.Decode(rmds.MD.SerializedPrivateMetadata, &encryptedPrivateMetadata); err != nil {
				return err
			}

			k, err := md.config.KeyManager().
				GetTLFCryptKeyForMDDecryption(ctx, &rmds.MD)

			if err != nil {
				return err
			}

			privateMetadata, err := crypto.DecryptPrivateMetadata(encryptedPrivateMetadata, k)
			if err != nil {
				return err
			}

			rmds.MD.data = *privateMetadata
		}

		// Make sure the last writer is really a valid writer
		writer := rmds.MD.data.LastWriter
		if !handle.IsWriter(writer) {
			return MDMismatchError{
				handle.ToString(ctx, md.config),
				fmt.Sprintf("MD (id=%s) was written by a non-writer %s",
					rmds.MD.ID, writer)}
		}

		// TODO:
		// Both of these have to happen after decryption so
		// we can see who the last writer was.
		kbpki := md.config.KBPKI()
		me, err := kbpki.GetLoggedInUser(ctx)
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
				return MDMismatchError{
					handle.ToString(ctx, md.config),
					fmt.Sprintf("MD (id=%s) is a private share but doesn't "+
						"contain a key for my logged in user (%s)",
						rmds.MD.ID, me)}
				// TODO: figure out the right kid for the writer, should
				// be in the mac somewhere
			} else if pubKey, err := md.config.KeyOps().GetMacPublicKey(
				ctx, writer); err != nil {
				return err
			} else if err := crypto.VerifyMAC(pubKey, buf, mac); err != nil {
				return err
			}
		} else {
			// For any home or public directory:
			//   * Verify normally using the user's public key matching
			//     the verifying key KID.
			// TODO: what do we do if the signature is from a revoked
			// key?
			err = kbpki.HasVerifyingKey(ctx, writer, rmds.SigInfo.VerifyingKey)
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

// GetForHandle implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) GetForHandle(ctx context.Context, handle *TlfHandle) (
	*RootMetadata, error) {
	mdserv := md.config.MDServer()
	if rmds, err := mdserv.GetForHandle(ctx, handle); err != nil {
		return nil, err
	} else if err := md.processMetadata(ctx, handle, rmds); err != nil {
		return nil, err
	} else {
		if rmds.IsInitialized() {
			// Make the the signed-over UIDs in the latest Keys match the handle
			handleString := handle.ToString(ctx, md.config)
			fetchedHandleString := rmds.MD.GetTlfHandle().
				ToString(ctx, md.config)
			if fetchedHandleString != handleString {
				return nil, MDMismatchError{
					handleString,
					fmt.Sprintf("MD (id=%s) contained unexpected handle %s",
						rmds.MD.ID, fetchedHandleString)}
			}
		}
		return &rmds.MD, nil
	}
}

func (md *MDOpsStandard) processMetadataWithID(ctx context.Context,
	id TlfID, rmds *RootMetadataSigned) error {
	// Make sure the signed-over ID matches
	if id != rmds.MD.ID {
		return MDMismatchError{
			id.String(),
			fmt.Sprintf("MD contained unexpected id %s",
				rmds.MD.ID.String()),
		}
	}
	return md.processMetadata(ctx, rmds.MD.GetTlfHandle(), rmds)
}

// GetForTLF implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) GetForTLF(ctx context.Context, id TlfID) (
	*RootMetadata, error) {
	rmds, err := md.config.MDServer().GetForTLF(ctx, id)
	if err != nil {
		return nil, err
	}
	err = md.processMetadataWithID(ctx, id, rmds)
	if err != nil {
		return nil, err
	}
	return &rmds.MD, nil
}

// Get implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) Get(ctx context.Context, mdID MdID) (
	*RootMetadata, error) {
	// TODO: implement a cache for non-current MD
	rmds, err := md.config.MDServer().Get(ctx, mdID)
	if err != nil {
		return nil, err
	}
	err = md.processMetadata(ctx, rmds.MD.GetTlfHandle(), rmds)
	if err != nil {
		return nil, err
	}
	// verify that mdID matches the returned MD
	realMdID, err := rmds.MD.MetadataID(md.config)
	if err != nil {
		return nil, err
	}
	if mdID != realMdID {
		return nil, MDMismatchError{
			rmds.MD.GetTlfHandle().ToString(ctx, md.config),
			fmt.Sprintf("MD returned for MdID %v really has an ID of %v",
				mdID, realMdID),
		}
	}
	return &rmds.MD, nil
}

func (md *MDOpsStandard) processRange(ctx context.Context, id TlfID,
	startRoot MdID, sinceRmds []*RootMetadataSigned) ([]*RootMetadata, error) {
	if sinceRmds == nil {
		return nil, nil
	}

	// verify each of the MD objects, and verify the PrevRoot pointers
	// are correct
	lastRoot := startRoot
	sinceRmd := make([]*RootMetadata, 0, len(sinceRmds))
	for _, rmds := range sinceRmds {
		currRoot, err := rmds.MD.MetadataID(md.config)
		if err != nil {
			return nil, err
		}

		// make sure the chain is correct
		if rmds.MD.PrevRoot != lastRoot && lastRoot != NullMdID {
			return nil, MDMismatchError{
				rmds.MD.GetTlfHandle().ToString(ctx, md.config),
				fmt.Sprintf("MD (id=%v) points to an unexpected root (%v) "+
					"instead of %v", currRoot, rmds.MD.PrevRoot, lastRoot),
			}
		}

		err = md.processMetadataWithID(ctx, id, rmds)
		if err != nil {
			return nil, err
		}
		lastRoot = currRoot
		sinceRmd = append(sinceRmd, &rmds.MD)
	}

	// TODO: in the case where startRoot == NullMdID, should we verify
	// that the starting PrevRoot points back to something that's
	// actually a valid part of this history?  If the MD signature is
	// indeed valid, this probably isn't a huge deal, but it may let
	// the server rollback or truncate unmerged history...

	return sinceRmd, nil
}

// GetSince implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) GetSince(ctx context.Context, id TlfID, mdID MdID,
	max int) ([]*RootMetadata, bool, error) {
	sinceRmds, more, err := md.config.MDServer().GetSince(ctx, id, mdID, max)
	if err != nil {
		return nil, false, err
	}
	sinceRmd, err := md.processRange(ctx, id, mdID, sinceRmds)
	if err != nil {
		return nil, false, err
	}
	return sinceRmd, more, nil
}

func (md *MDOpsStandard) readyMD(ctx context.Context, id TlfID,
	rmd *RootMetadata) (MdID, *RootMetadataSigned, error) {
	me, err := md.config.KBPKI().GetLoggedInUser(ctx)
	if err != nil {
		return NullMdID, nil, err
	}
	rmd.data.LastWriter = me

	// First encode (and maybe encrypt) the root data
	codec := md.config.Codec()
	crypto := md.config.Crypto()
	if id.IsPublic() {
		encodedPrivateMetadata, err := codec.Encode(rmd.data)
		if err != nil {
			return NullMdID, nil, err
		}
		rmd.SerializedPrivateMetadata = encodedPrivateMetadata
	} else {
		k, err := md.config.KeyManager().GetTLFCryptKeyForEncryption(ctx, rmd)
		if err != nil {
			return NullMdID, nil, err
		}

		encryptedPrivateMetadata, err := crypto.EncryptPrivateMetadata(&rmd.data, k)
		if err != nil {
			return NullMdID, nil, err
		}

		encodedEncryptedPrivateMetadata, err := codec.Encode(encryptedPrivateMetadata)
		if err != nil {
			return NullMdID, nil, err
		}
		rmd.SerializedPrivateMetadata = encodedEncryptedPrivateMetadata
	}

	// encode the metadata and sign it
	buf, err := codec.Encode(rmd)
	if err != nil {
		return NullMdID, nil, err
	}

	handle := rmd.GetTlfHandle()
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
			if pubKey, err :=
				md.config.KeyOps().GetMacPublicKey(ctx, user); err != nil {
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
				return NullMdID, nil, err
			}
		}
		for _, r := range handle.Readers {
			if err := macFunc(r); err != nil {
				return NullMdID, nil, err
			}
		}
	} else {
		// For our home and public directory:
		//   * Sign normally using the local device private key
		sigInfo, err := crypto.Sign(ctx, buf)
		if err != nil {
			return NullMdID, nil, err
		}
		rmds.SigInfo = sigInfo
	}

	mdID, err := rmd.MetadataID(md.config)
	if err != nil {
		return NullMdID, nil, err
	}
	return mdID, rmds, nil
}

// Put implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) Put(ctx context.Context, id TlfID, rmd *RootMetadata,
	deviceKID keybase1.KID, unmergedBase MdID) error {
	mdID, rmds, err := md.readyMD(ctx, id, rmd)
	if err != nil {
		return err
	}
	return md.config.MDServer().
		Put(ctx, id, mdID, rmds, deviceKID, unmergedBase)
}

// PutUnmerged implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) PutUnmerged(ctx context.Context, id TlfID,
	rmd *RootMetadata, deviceKID keybase1.KID) error {
	// TODO: set unmerged bit in rmd.
	mdID, rmds, err := md.readyMD(ctx, id, rmd)
	if err != nil {
		return err
	}
	return md.config.MDServer().PutUnmerged(ctx, id, mdID, rmds, deviceKID)
}

// GetUnmergedSince implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) GetUnmergedSince(ctx context.Context, id TlfID,
	deviceKID keybase1.KID, mdID MdID, max int) ([]*RootMetadata, bool, error) {
	sinceRmds, more, err :=
		md.config.MDServer().GetUnmergedSince(ctx, id, deviceKID, mdID, max)
	if err != nil {
		return nil, false, err
	}
	sinceRmd, err := md.processRange(ctx, id, mdID, sinceRmds)
	if err != nil {
		return nil, false, err
	}
	return sinceRmd, more, nil
}

// GetFavorites implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) GetFavorites(ctx context.Context) ([]TlfID, error) {
	return md.config.MDServer().GetFavorites(ctx)
}
