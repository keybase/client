package teams

import (
	"context"
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/keybase1"
)

func RenameSubteam(ctx context.Context, g *libkb.GlobalContext, prevName keybase1.TeamName, newName keybase1.TeamName) error {
	g.Log.CDebugf(ctx, "RenameSubteam %v -> %v", prevName, newName)

	if prevName.IsRootTeam() {
		return fmt.Errorf("cannot rename root team: %s", prevName.String())
	}
	if prevName.Depth() < 2 {
		return fmt.Errorf("cannot rename team: '%v'", prevName)
	}
	if newName.Depth() != prevName.Depth() {
		return fmt.Errorf("cannot change depth of team: %v (%v) -> %v (%v)",
			prevName, prevName.Depth(), newName, newName.Depth())
	}
	parentName, err := prevName.Parent()
	if err != nil {
		return err
	}
	checkParentName, err := newName.Parent()
	if err != nil {
		// this should never happen
		return fmt.Errorf("error checking new name: %v", err)
	}
	if !checkParentName.Eq(parentName) {
		return fmt.Errorf("cannot rename teams with different parents: %v != %v", checkParentName, parentName)
	}
	if prevName.Eq(newName) {
		return fmt.Errorf("cannot rename team without changing name")
	}

	return RetryOnSigOldSeqnoError(ctx, g, func(ctx context.Context, _ int) error {
		g.Log.CDebugf(ctx, "RenameSubteam load teams: parent:'%v' subteam:'%v'",
			parentName.String(), prevName.String())
		parent, err := GetForTeamManagementByStringName(ctx, g, parentName.String(), true)
		if err != nil {
			return err
		}
		subteam, err := GetForTeamManagementByStringName(ctx, g, prevName.String(), false)
		if err != nil {
			return err
		}

		g.Log.CDebugf(ctx, "RenameSubteam load me")
		me, err := loadMeForSignatures(ctx, g)
		if err != nil {
			return err
		}

		deviceSigningKey, err := g.ActiveDevice.SigningKey()
		if err != nil {
			return err
		}

		admin, err := parent.getAdminPermission(ctx, true)
		if err != nil {
			return err
		}

		err = parent.ForceMerkleRootUpdate(ctx)
		if err != nil {
			return err
		}

		// Subteam renaming involves two links, one `rename_subteam` in the parent
		// team's chain, and one `rename_up_pointer` in the subteam's chain.

		g.Log.CDebugf(ctx, "RenameSubteam make sigs")
		renameSubteamSig, err := generateRenameSubteamSigForParentChain(
			g, me, deviceSigningKey, parent.chain(), subteam.ID, newName, admin)
		if err != nil {
			return err
		}

		renameUpPointerSig, err := generateRenameUpPointerSigForSubteamChain(
			g, me, deviceSigningKey, chainPair{parent: parent.chain(), subteam: subteam.chain()}, newName, admin)
		if err != nil {
			return err
		}

		err = precheckLinkToPost(ctx, g, *renameSubteamSig, parent.chain(), me.ToUserVersion())
		if err != nil {
			return fmt.Errorf("cannot post link (precheck rename subteam): %v", err)
		}

		err = precheckLinkToPost(ctx, g, *renameUpPointerSig, subteam.chain(), me.ToUserVersion())
		if err != nil {
			return fmt.Errorf("cannot post link (precheck rename up): %v", err)
		}

		payload := make(libkb.JSONPayload)
		payload["sigs"] = []interface{}{renameSubteamSig, renameUpPointerSig}

		g.Log.CDebugf(ctx, "RenameSubteam post")
		_, err = g.API.PostJSON(libkb.APIArg{
			Endpoint:    "sig/multi",
			SessionType: libkb.APISessionTypeREQUIRED,
			JSONPayload: payload,
		})
		if err != nil {
			return err
		}

		go g.GetTeamLoader().NotifyTeamRename(ctx, subteam.ID, newName.String())

		return nil
	})
}

func generateRenameSubteamSigForParentChain(g *libkb.GlobalContext, me libkb.UserForSignatures, signingKey libkb.GenericKey, parentTeam *TeamSigChainState, subteamID keybase1.TeamID, newSubteamName keybase1.TeamName, admin *SCTeamAdmin) (item *libkb.SigMultiItem, err error) {

	entropy, err := makeSCTeamEntropy()
	if err != nil {
		return nil, err
	}

	teamSection := SCTeamSection{
		Admin: admin,
		ID:    (SCTeamID)(parentTeam.GetID()),
		Subteam: &SCSubteam{
			ID:   (SCTeamID)(subteamID),
			Name: (SCTeamName)(newSubteamName.String()),
		},
		Entropy: entropy,
	}

	sigBody, err := RenameSubteamSig(g, me, signingKey, parentTeam, teamSection)
	if err != nil {
		return nil, err
	}
	sigJSON, err := sigBody.Marshal()
	if err != nil {
		return nil, err
	}

	prevLinkID, err := libkb.ImportLinkID(parentTeam.GetLatestLinkID())
	if err != nil {
		return nil, err
	}
	seqType := seqTypeForTeamPublicness(parentTeam.IsPublic())
	v2Sig, _, _, err := libkb.MakeSigchainV2OuterSig(
		signingKey,
		libkb.LinkTypeRenameSubteam,
		parentTeam.GetLatestSeqno()+1,
		sigJSON,
		prevLinkID,
		libkb.SigHasRevokes(false),
		seqType,
		libkb.SigIgnoreIfUnsupported(false),
	)
	if err != nil {
		return nil, err
	}

	item = &libkb.SigMultiItem{
		Sig:        v2Sig,
		SigningKID: signingKey.GetKID(),
		Type:       string(libkb.LinkTypeRenameSubteam),
		SeqType:    seqType,
		SigInner:   string(sigJSON),
		TeamID:     parentTeam.GetID(),
	}
	return item, nil
}

type chainPair struct {
	parent  *TeamSigChainState
	subteam *TeamSigChainState
}

func generateRenameUpPointerSigForSubteamChain(g *libkb.GlobalContext, me libkb.UserForSignatures, signingKey libkb.GenericKey, teams chainPair, newSubteamName keybase1.TeamName, admin *SCTeamAdmin) (item *libkb.SigMultiItem, err error) {
	newSubteamNameStr := newSubteamName.String()
	teamSection := SCTeamSection{
		Admin: admin,
		ID:    (SCTeamID)(teams.subteam.GetID()),
		Name:  (*SCTeamName)(&newSubteamNameStr),
		Parent: &SCTeamParent{
			ID:      SCTeamID(teams.parent.GetID()),
			Seqno:   teams.parent.GetLatestSeqno() + 1, // the seqno of the *new* parent link
			SeqType: seqTypeForTeamPublicness(teams.parent.IsPublic()),
		},
	}

	sigBody, err := RenameUpPointerSig(g, me, signingKey, teams.subteam, teamSection)
	if err != nil {
		return nil, err
	}
	sigJSON, err := sigBody.Marshal()
	if err != nil {
		return nil, err
	}

	prevLinkID, err := libkb.ImportLinkID(teams.subteam.GetLatestLinkID())
	if err != nil {
		return nil, err
	}
	seqType := seqTypeForTeamPublicness(teams.subteam.IsPublic())
	v2Sig, _, _, err := libkb.MakeSigchainV2OuterSig(
		signingKey,
		libkb.LinkTypeRenameUpPointer,
		teams.subteam.GetLatestSeqno()+1,
		sigJSON,
		prevLinkID,
		libkb.SigHasRevokes(false),
		seqType,
		libkb.SigIgnoreIfUnsupported(false),
	)
	if err != nil {
		return nil, err
	}

	item = &libkb.SigMultiItem{
		Sig:        v2Sig,
		SigningKID: signingKey.GetKID(),
		Type:       string(libkb.LinkTypeRenameUpPointer),
		SeqType:    seqType,
		SigInner:   string(sigJSON),
		TeamID:     teams.subteam.GetID(),
	}
	return item, nil
}
