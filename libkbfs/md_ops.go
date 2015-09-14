package libkbfs

import (
	"fmt"

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

		// re-marshal the metadata
		// TODO: can we somehow avoid the re-marshaling by saving the
		// marshalled metadata somewhere?
		buf, err := codec.Encode(rmds.MD)
		if err != nil {
			return err
		}

		// TODO: what do we do if the signature is from a revoked
		// key?
		kbpki := md.config.KBPKI()
		err = kbpki.HasVerifyingKey(ctx, writer, rmds.SigInfo.VerifyingKey)
		if err != nil {
			return err
		}

		err = crypto.Verify(buf, rmds.SigInfo)
		if err != nil {
			return err
		}
	}
	return nil
}

func (md *MDOpsStandard) getForHandle(ctx context.Context, handle *TlfHandle, Unmerged bool) (
	*RootMetadata, error) {
	mdserv := md.config.MDServer()
	id, rmds, err := mdserv.GetForHandle(ctx, handle, Unmerged)
	if err != nil {
		return nil, err
	}
	if rmds == nil {
		// create one if it doesn't exist
		rmd := NewRootMetadata(handle, id)
		rmds = &RootMetadataSigned{MD: *rmd}
	}
	if err := md.processMetadata(ctx, handle, rmds); err != nil {
		return nil, err
	}
	if rmds.IsInitialized() {
		// Make the the signed-over UIDs in the latest Keys match the handle
		handleString := handle.ToString(ctx, md.config)
		fetchedHandleString := rmds.MD.GetTlfHandle().ToString(ctx, md.config)
		if fetchedHandleString != handleString {
			return nil, MDMismatchError{
				handleString,
				fmt.Sprintf("MD (id=%s) contained unexpected handle %s",
					rmds.MD.ID, fetchedHandleString),
			}
		}
	}
	return &rmds.MD, nil
}

// GetForHandle implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) GetForHandle(ctx context.Context, handle *TlfHandle) (
	*RootMetadata, error) {
	return md.getForHandle(ctx, handle, false)
}

// GetUnmergedForHandle implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) GetUnmergedForHandle(ctx context.Context, handle *TlfHandle) (
	*RootMetadata, error) {
	return md.getForHandle(ctx, handle, true)
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

func (md *MDOpsStandard) getForTLF(ctx context.Context, id TlfID, Unmerged bool) (
	*RootMetadata, error) {
	rmds, err := md.config.MDServer().GetForTLF(ctx, id, Unmerged)
	if err != nil {
		return nil, err
	}
	if rmds == nil {
		// Possible if unmerged is true.
		return nil, nil
	}
	err = md.processMetadataWithID(ctx, id, rmds)
	if err != nil {
		return nil, err
	}
	return &rmds.MD, nil
}

// GetForTLF implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) GetForTLF(ctx context.Context, id TlfID) (
	*RootMetadata, error) {
	return md.getForTLF(ctx, id, false)
}

// GetUnmergedForTLF implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) GetUnmergedForTLF(ctx context.Context, id TlfID) (
	*RootMetadata, error) {
	return md.getForTLF(ctx, id, true)
}

func (md *MDOpsStandard) processRange(ctx context.Context, id TlfID,
	rmds []*RootMetadataSigned) ([]*RootMetadata, error) {
	if rmds == nil {
		return nil, nil
	}

	// verify each of the MD objects, and verify the PrevRoot pointers
	// are correct
	lastRoot, lastRevision := MdID{}, MetadataRevision(0)
	rmd := make([]*RootMetadata, 0, len(rmds))
	for _, r := range rmds {
		currRoot, err := r.MD.MetadataID(md.config)
		if err != nil {
			return nil, err
		}
		//
		// make sure the chain is correct
		//
		// (1) check revision
		if r.MD.Revision != lastRevision+1 && lastRevision != 0 {
			return nil, MDMismatchError{
				r.MD.GetTlfHandle().ToString(ctx, md.config),
				fmt.Sprintf("MD (id=%v) is at an unexpected revision (%d) "+
					"instead of %d", currRoot, r.MD.Revision.Number(),
					lastRevision.Number()+1),
			}
		}
		// (2) check PrevRoot pointer
		if r.MD.PrevRoot != lastRoot && lastRoot != (MdID{}) {
			return nil, MDMismatchError{
				r.MD.GetTlfHandle().ToString(ctx, md.config),
				fmt.Sprintf("MD (id=%v) points to an unexpected root (%v) "+
					"instead of %v", currRoot, r.MD.PrevRoot, lastRoot),
			}
		}

		err = md.processMetadataWithID(ctx, id, r)
		if err != nil {
			return nil, err
		}
		lastRoot, lastRevision = currRoot, r.MD.Revision
		rmd = append(rmd, &r.MD)
	}

	// TODO: in the case where lastRoot == MdID{}, should we verify
	// that the starting PrevRoot points back to something that's
	// actually a valid part of this history?  If the MD signature is
	// indeed valid, this probably isn't a huge deal, but it may let
	// the server rollback or truncate unmerged history...

	return rmd, nil
}

func (md *MDOpsStandard) getRange(ctx context.Context, id TlfID, Unmerged bool,
	start, stop MetadataRevision) ([]*RootMetadata, error) {
	rmds, err := md.config.MDServer().GetRange(ctx, id, Unmerged, start, stop)
	if err != nil {
		return nil, err
	}
	rmd, err := md.processRange(ctx, id, rmds)
	if err != nil {
		return nil, err
	}
	return rmd, nil
}

// GetRange implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) GetRange(ctx context.Context, id TlfID,
	start, stop MetadataRevision) ([]*RootMetadata, error) {
	return md.getRange(ctx, id, false, start, stop)
}

// GetUnmergedRange implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) GetUnmergedRange(ctx context.Context, id TlfID,
	start, stop MetadataRevision) ([]*RootMetadata, error) {
	return md.getRange(ctx, id, true, start, stop)
}

func (md *MDOpsStandard) readyMD(ctx context.Context, rmd *RootMetadata) (
	*RootMetadataSigned, error) {
	me, err := md.config.KBPKI().GetLoggedInUser(ctx)
	if err != nil {
		return nil, err
	}
	rmd.data.LastWriter = me

	// First encode (and maybe encrypt) the root data
	codec := md.config.Codec()
	crypto := md.config.Crypto()
	if rmd.ID.IsPublic() {
		encodedPrivateMetadata, err := codec.Encode(rmd.data)
		if err != nil {
			return nil, err
		}
		rmd.SerializedPrivateMetadata = encodedPrivateMetadata
	} else {
		k, err := md.config.KeyManager().GetTLFCryptKeyForEncryption(ctx, rmd)
		if err != nil {
			return nil, err
		}

		encryptedPrivateMetadata, err := crypto.EncryptPrivateMetadata(&rmd.data, k)
		if err != nil {
			return nil, err
		}

		encodedEncryptedPrivateMetadata, err := codec.Encode(encryptedPrivateMetadata)
		if err != nil {
			return nil, err
		}

		rmd.SerializedPrivateMetadata = encodedEncryptedPrivateMetadata
	}

	// encode the metadata and sign it
	buf, err := codec.Encode(rmd)
	if err != nil {
		return nil, err
	}

	rmds := &RootMetadataSigned{}
	rmds.MD = *rmd
	// Sign normally using the local device private key
	sigInfo, err := crypto.Sign(ctx, buf)
	if err != nil {
		return nil, err
	}
	rmds.SigInfo = sigInfo

	return rmds, nil
}

// Put implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) Put(ctx context.Context, rmd *RootMetadata) error {
	rmds, err := md.readyMD(ctx, rmd)
	if err != nil {
		return err
	}
	err = md.config.MDServer().Put(ctx, rmds)
	if err != nil {
		return err
	}
	if rmd.MergedStatus() == Unmerged {
		return nil
	}
	// or else prune all unmerged history now
	return md.config.MDServer().PruneUnmerged(ctx, rmd.ID)
}

// PutUnmerged implements the MDOps interface for MDOpsStandard.
func (md *MDOpsStandard) PutUnmerged(ctx context.Context, rmd *RootMetadata) error {
	rmd.Flags |= MetadataFlagUnmerged
	return md.Put(ctx, rmd)
}
