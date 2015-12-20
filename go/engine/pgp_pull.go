// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

package engine

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	keybase1 "github.com/keybase/client/go/protocol"
)

type PGPPullEngineArg struct {
	UserAsserts []string
}

type PGPPullEngine struct {
	listTrackingEngine *ListTrackingEngine
	userAsserts        []string
	gpgClient          *libkb.GpgCLI
	libkb.Contextified
}

func NewPGPPullEngine(arg *PGPPullEngineArg, g *libkb.GlobalContext) *PGPPullEngine {
	return &PGPPullEngine{
		listTrackingEngine: NewListTrackingEngine(&ListTrackingEngineArg{}, g),
		userAsserts:        arg.UserAsserts,
		Contextified:       libkb.NewContextified(g),
	}
}

func (e *PGPPullEngine) Name() string {
	return "PGPPull"
}

func (e *PGPPullEngine) Prereqs() Prereqs {
	return Prereqs{}
}

func (e *PGPPullEngine) RequiredUIs() []libkb.UIKind {
	return []libkb.UIKind{
		libkb.LogUIKind,
	}
}

func (e *PGPPullEngine) SubConsumers() []libkb.UIConsumer {
	return []libkb.UIConsumer{e.listTrackingEngine}
}

func proofSetFromUserSummary(summary keybase1.UserSummary) *libkb.ProofSet {
	proofs := []libkb.Proof{
		{Key: "keybase", Value: summary.Username},
		{Key: "uid", Value: summary.Uid.String()},
	}
	for _, socialProof := range summary.Proofs.Social {
		proofs = append(proofs, libkb.Proof{
			Key:   socialProof.ProofType,
			Value: socialProof.ProofName,
		})
	}
	for _, webProof := range summary.Proofs.Web {
		for _, protocol := range webProof.Protocols {
			proofs = append(proofs, libkb.Proof{
				Key:   protocol,
				Value: webProof.Hostname,
			})
		}
	}
	return libkb.NewProofSet(proofs)
}

func (e *PGPPullEngine) getTrackedUserSummaries(ctx *Context) ([]keybase1.UserSummary, error) {
	err := RunEngine(e.listTrackingEngine, ctx)
	if err != nil {
		return nil, err
	}
	allTrackedSummaries := e.listTrackingEngine.TableResult()

	// Without any userAsserts specified, just return everything.
	if e.userAsserts == nil || len(e.userAsserts) == 0 {
		return allTrackedSummaries, nil
	}

	// With userAsserts specified, return only those summaries. If an assert
	// doesn't match any tracked users, that's an error. If an assert matches
	// more than one tracked user, that is also an error. If multiple
	// assertions match the same user, that's fine.

	// First parse all the assertion expressions.
	parsedAsserts := make(map[string]libkb.AssertionExpression)
	for _, assertString := range e.userAsserts {
		assertExpr, err := libkb.AssertionParseAndOnly(assertString)
		if err != nil {
			return nil, err
		}
		parsedAsserts[assertString] = assertExpr
	}

	// Then loop over all the tracked users, keeping track of which expressions
	// have matched before.
	matchedSummaries := make(map[string]keybase1.UserSummary)
	assertionsUsed := make(map[string]bool)
	for _, summary := range allTrackedSummaries {
		proofSet := proofSetFromUserSummary(summary)
		for assertStr, parsedAssert := range parsedAsserts {
			if parsedAssert.MatchSet(*proofSet) {
				if assertionsUsed[assertStr] {
					return nil, fmt.Errorf("Assertion \"%s\" matched more than one tracked user.", assertStr)
				}
				assertionsUsed[assertStr] = true
				matchedSummaries[summary.Username] = summary
			}
		}
	}

	// Make sure every assertion found a match.
	for _, assertString := range e.userAsserts {
		if !assertionsUsed[assertString] {
			return nil, fmt.Errorf("Assertion \"%s\" did not match any tracked users.", assertString)
		}
	}

	matchedList := []keybase1.UserSummary{}
	for _, summary := range matchedSummaries {
		matchedList = append(matchedList, summary)
	}
	return matchedList, nil
}

func (e *PGPPullEngine) runLoggedOut(ctx *Context) error {
	if len(e.userAsserts) == 0 {
		return libkb.PGPPullLoggedOutError{}
	}
	for _, assertString := range e.userAsserts {
		if err := e.processUserWhenLoggedOut(ctx, assertString); err != nil {
			return err
		}
	}
	return nil
}

func (e *PGPPullEngine) processUserWhenLoggedOut(ctx *Context, u string) error {
	iarg := NewIdentifyTrackArg(u, false, true, keybase1.TrackOptions{
		LocalOnly: true,
	})
	ieng := NewIdentify(iarg, e.G())
	if err := RunEngine(ieng, ctx); err != nil {
		e.G().Log.Info("identify run err: %s", err)
		return err
	}

	// prompt if the identify is correct
	outcome := ieng.Outcome().Export()
	outcome.ForPGPPull = true
	result, err := ctx.IdentifyUI.Confirm(outcome)
	if err != nil {
		return err
	}

	if !result.IdentityConfirmed {
		e.G().Log.Warning("Not confirmed; skipping key import")
		return nil
	}

	if err = e.exportKeysToGPG(ctx, ieng.User(), nil); err != nil {
		return err
	}

	return nil
}

func (e *PGPPullEngine) Run(ctx *Context) error {

	e.gpgClient = libkb.NewGpgCLI(e.G(), ctx.LogUI)
	err := e.gpgClient.Configure()
	if err != nil {
		return err
	}

	if ok, _ := IsLoggedIn(e, ctx); !ok {
		return e.runLoggedOut(ctx)
	}

	summaries, err := e.getTrackedUserSummaries(ctx)
	if err != nil {
		return err
	}

	return e.runLoggedIn(ctx, summaries)
}

func (e *PGPPullEngine) runLoggedIn(ctx *Context, summaries []keybase1.UserSummary) error {

	// Loop over the list of all users we track.
	for _, userSummary := range summaries {
		// Compute the set of tracked pgp fingerprints. LoadUser will fetch key
		// data from the server, and we will compare it against this.
		trackedFingerprints := make(map[string]bool)
		for _, pubKey := range userSummary.Proofs.PublicKeys {
			if pubKey.PGPFingerprint != "" {
				trackedFingerprints[pubKey.PGPFingerprint] = true
			}
		}

		// Get user data from the server.
		user, err := libkb.LoadUser(libkb.NewLoadUserByNameArg(e.G(), userSummary.Username))
		if err != nil {
			ctx.LogUI.Errorf("Failed to load user %s: %s", userSummary.Username, err)
			continue
		}

		if err = e.exportKeysToGPG(ctx, user, trackedFingerprints); err != nil {
			return err
		}
	}
	return nil
}

func (e *PGPPullEngine) exportKeysToGPG(ctx *Context, user *libkb.User, tfp map[string]bool) error {
	for _, bundle := range user.GetActivePGPKeys(false) {
		// Check each key against the tracked set.
		if tfp != nil && !tfp[bundle.GetFingerprint().String()] {
			ctx.LogUI.Warning("Keybase says that %s owns key %s, but you have not tracked this fingerprint before.", user.GetName(), bundle.GetFingerprint())
			continue
		}

		if err := e.gpgClient.ExportKey(*bundle, false /* export public key only */); err != nil {
			return err
		}

		ctx.LogUI.Info("Imported key for %s.", user.GetName())
	}
	return nil
}
