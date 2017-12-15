// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

// This file has the online resolving functionality for TlfHandles.

import (
	"errors"
	"fmt"
	"reflect"
	"sort"
	"strings"

	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/keybase/kbfs/kbfscodec"
	"github.com/keybase/kbfs/kbfsmd"
	"github.com/keybase/kbfs/tlf"
	"golang.org/x/net/context"
)

type nameIDPair struct {
	name libkb.NormalizedUsername
	id   keybase1.UserOrTeamID
}

type resolvableUser interface {
	// resolve must do exactly one of the following:
	//
	//   - return a non-zero nameIDPair;
	//   - return a non-zero keybase1.SocialAssertion;
	//   - return a non-nil error.
	//
	// The TLF ID may or may not be filled in, depending on whether
	// the name is backed by an implicit team.
	resolve(context.Context) (
		nameIDPair, keybase1.SocialAssertion, tlf.ID, error)
}

func resolveOneUser(
	ctx context.Context, user resolvableUser,
	errCh chan<- error, userInfoResults chan<- nameIDPair,
	socialAssertionResults chan<- keybase1.SocialAssertion,
	idResults chan<- tlf.ID) {
	userInfo, socialAssertion, id, err := user.resolve(ctx)
	if err != nil {
		select {
		case errCh <- err:
		default:
			// another worker reported an error before us;
			// first one wins
		}
		return
	}

	// The ID has to be sent first, to guarantee it's in the channel
	// before it is closed.
	if id != tlf.NullID {
		select {
		case idResults <- id:
		default:
			errCh <- fmt.Errorf(
				"Sending ID %s failed; one ID has probably already been sent",
				id)
			return
		}
	}

	if userInfo != (nameIDPair{}) {
		userInfoResults <- userInfo
		return
	}

	if socialAssertion != (keybase1.SocialAssertion{}) {
		socialAssertionResults <- socialAssertion
		return
	}

	errCh <- fmt.Errorf("Resolving %v resulted in empty userInfo and empty socialAssertion", user)
}

func getNames(idToName map[keybase1.UserOrTeamID]libkb.NormalizedUsername) []libkb.NormalizedUsername {
	var names []libkb.NormalizedUsername
	for _, name := range idToName {
		names = append(names, name)
	}
	return names
}

func makeTlfHandleHelper(
	ctx context.Context, t tlf.Type, writers, readers []resolvableUser,
	extensions []tlf.HandleExtension, idGetter tlfIDGetter) (
	*TlfHandle, error) {
	if t != tlf.Private && len(readers) > 0 {
		return nil, errors.New("public or team folder cannot have readers")
	} else if t == tlf.SingleTeam && len(writers) != 1 {
		return nil, errors.New("team folder cannot have more than one writer")
	}

	// parallelize the resolutions for each user
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	errCh := make(chan error, 1)

	wc := make(chan nameIDPair, len(writers))
	uwc := make(chan keybase1.SocialAssertion, len(writers))
	// We are only expecting at most one ID.  `resolveOneError` should
	// error if it can't send an ID immediately.
	idc := make(chan tlf.ID, 1)
	for _, writer := range writers {
		go resolveOneUser(ctx, writer, errCh, wc, uwc, idc)
	}

	rc := make(chan nameIDPair, len(readers))
	urc := make(chan keybase1.SocialAssertion, len(readers))
	for _, reader := range readers {
		go resolveOneUser(ctx, reader, errCh, rc, urc, idc)
	}

	usedWNames :=
		make(map[keybase1.UserOrTeamID]libkb.NormalizedUsername, len(writers))
	usedRNames :=
		make(map[keybase1.UserOrTeamID]libkb.NormalizedUsername, len(readers))
	usedUnresolvedWriters := make(map[keybase1.SocialAssertion]bool)
	usedUnresolvedReaders := make(map[keybase1.SocialAssertion]bool)
	for i := 0; i < len(writers)+len(readers); i++ {
		select {
		case err := <-errCh:
			return nil, err
		case userInfo := <-wc:
			usedWNames[userInfo.id] = userInfo.name
		case userInfo := <-rc:
			usedRNames[userInfo.id] = userInfo.name
		case socialAssertion := <-uwc:
			usedUnresolvedWriters[socialAssertion] = true
		case socialAssertion := <-urc:
			usedUnresolvedReaders[socialAssertion] = true
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
	// It's safe to close the channel now before we receive from it,
	// since the ID is always sent first, because the usernames and
	// assertions.
	close(idc)
	tlfID := tlf.NullID
	more := false
	select {
	case tlfID, more = <-idc:
	default:
	}

	if more {
		// Just make sure a second one didn't slip in (only possible if
		// `resolveOneUser` has a bug.
		select {
		case tlfID2, more := <-idc:
			if more {
				return nil, fmt.Errorf(
					"More than one TLF ID returned: %s and %s", tlfID, tlfID2)
			}
		default:
		}
	}

	for id := range usedWNames {
		delete(usedRNames, id)
	}

	for sa := range usedUnresolvedWriters {
		delete(usedUnresolvedReaders, sa)
	}

	unresolvedWriters := getSortedUnresolved(usedUnresolvedWriters)

	var unresolvedReaders []keybase1.SocialAssertion
	if t == tlf.Private {
		unresolvedReaders = getSortedUnresolved(usedUnresolvedReaders)
	}

	canonicalName := tlf.MakeCanonicalName(
		getNames(usedWNames), unresolvedWriters,
		getNames(usedRNames), unresolvedReaders, extensions)

	extensionList := tlf.HandleExtensionList(extensions)
	sort.Sort(extensionList)
	conflictInfo, finalizedInfo := extensionList.Splat()

	isImplicit := false
	if t != tlf.SingleTeam && len(writers) == 1 && len(readers) == 0 {
		// There's only one ID, but iterating is the only good way to
		// get it out of the map.
		for id := range usedWNames {
			isImplicit = id.IsTeam()
		}
	}

	switch t {
	case tlf.Private:
		// All writers and readers must be users.
		for id := range usedWNames {
			if !isImplicit && !id.IsUser() {
				return nil, NoSuchNameError{Name: string(canonicalName)}
			}
		}
		for id := range usedRNames {
			if !id.IsUser() {
				return nil, NoSuchNameError{Name: string(canonicalName)}
			}
		}
	case tlf.Public:
		// All writers must be users.
		for id := range usedWNames {
			if !isImplicit && !id.IsUser() {
				return nil, NoSuchNameError{Name: string(canonicalName)}
			}
		}
	case tlf.SingleTeam:
		// The writer must be a team.
		for id := range usedWNames {
			if !id.IsTeamOrSubteam() {
				return nil, NoSuchNameError{Name: string(canonicalName)}
			}
		}
	default:
		panic(fmt.Sprintf("Unknown TLF type: %s", t))
	}

	h := &TlfHandle{
		tlfType:           t,
		resolvedWriters:   usedWNames,
		resolvedReaders:   usedRNames,
		unresolvedWriters: unresolvedWriters,
		unresolvedReaders: unresolvedReaders,
		conflictInfo:      conflictInfo,
		finalizedInfo:     finalizedInfo,
		name:              canonicalName,
		tlfID:             tlfID,
	}

	if !isImplicit && h.tlfID == tlf.NullID && idGetter != nil {
		// If this isn't an implicit team yet, look up possible
		// pre-existing TLF ID from the mdserver.
		tlfID, err := idGetter.GetIDForHandle(ctx, h)
		if err != nil {
			return nil, err
		}
		h.tlfID = tlfID
	}

	return h, nil
}

type resolvableID struct {
	nug normalizedUsernameGetter
	id  keybase1.UserOrTeamID
}

func (ruid resolvableID) resolve(ctx context.Context) (
	nameIDPair, keybase1.SocialAssertion, tlf.ID, error) {
	name, err := ruid.nug.GetNormalizedUsername(ctx, ruid.id)
	if err != nil {
		return nameIDPair{}, keybase1.SocialAssertion{}, tlf.NullID, err
	}
	// TODO(KBFS-2621): get the TLF ID and display name for implicit
	// teams. Blocked on CORE-6623.
	return nameIDPair{
		name: name,
		id:   ruid.id,
	}, keybase1.SocialAssertion{}, tlf.NullID, nil
}

type resolvableSocialAssertion keybase1.SocialAssertion

func (rsa resolvableSocialAssertion) resolve(ctx context.Context) (
	nameIDPair, keybase1.SocialAssertion, tlf.ID, error) {
	return nameIDPair{}, keybase1.SocialAssertion(rsa), tlf.NullID, nil
}

// MakeTlfHandle creates a TlfHandle from the given tlf.Handle and the
// given normalizedUsernameGetter (which is usually a KBPKI).
func MakeTlfHandle(
	ctx context.Context, bareHandle tlf.Handle,
	nug normalizedUsernameGetter, idGetter tlfIDGetter) (*TlfHandle, error) {
	writers := make([]resolvableUser, 0, len(bareHandle.Writers)+len(bareHandle.UnresolvedWriters))
	for _, w := range bareHandle.Writers {
		writers = append(writers, resolvableID{nug, w})
	}
	for _, uw := range bareHandle.UnresolvedWriters {
		writers = append(writers, resolvableSocialAssertion(uw))
	}

	var readers []resolvableUser
	if bareHandle.Type() == tlf.Private {
		readers = make([]resolvableUser, 0, len(bareHandle.Readers)+len(bareHandle.UnresolvedReaders))
		for _, r := range bareHandle.Readers {
			readers = append(readers, resolvableID{nug, r})
		}
		for _, ur := range bareHandle.UnresolvedReaders {
			readers = append(readers, resolvableSocialAssertion(ur))
		}
	}

	h, err := makeTlfHandleHelper(
		ctx, bareHandle.Type(), writers, readers, bareHandle.Extensions(),
		idGetter)
	if err != nil {
		return nil, err
	}

	newHandle, err := h.ToBareHandle()
	if err != nil {
		return nil, err
	}
	if !reflect.DeepEqual(newHandle, bareHandle) {
		panic(fmt.Errorf("newHandle=%+v unexpectedly not equal to bareHandle=%+v", newHandle, bareHandle))
	}

	return h, nil
}

type resolvableNameUIDPair nameIDPair

func (rp resolvableNameUIDPair) resolve(ctx context.Context) (
	nameIDPair, keybase1.SocialAssertion, tlf.ID, error) {
	return nameIDPair(rp), keybase1.SocialAssertion{}, tlf.NullID, nil
}

// ResolveAgainForUser tries to resolve any unresolved assertions in
// the given handle and returns a new handle with the results. As an
// optimization, if h contains no unresolved assertions, it just
// returns itself.  If uid != keybase1.UID(""), it only allows
// assertions that resolve to uid.
func (h *TlfHandle) ResolveAgainForUser(ctx context.Context, resolver resolver,
	idGetter tlfIDGetter, uid keybase1.UID) (*TlfHandle, error) {
	if len(h.unresolvedWriters)+len(h.unresolvedReaders) == 0 {
		return h, nil
	}

	writers := make([]resolvableUser, 0, len(h.resolvedWriters)+len(h.unresolvedWriters))
	for uid, w := range h.resolvedWriters {
		writers = append(writers, resolvableNameUIDPair{w, uid})
	}
	for _, uw := range h.unresolvedWriters {
		writers = append(writers, resolvableAssertion{resolver, nil,
			uw.String(), uid})
	}

	var readers []resolvableUser
	if h.Type() == tlf.Private {
		readers = make([]resolvableUser, 0, len(h.resolvedReaders)+len(h.unresolvedReaders))
		for uid, r := range h.resolvedReaders {
			readers = append(readers, resolvableNameUIDPair{r, uid})
		}
		for _, ur := range h.unresolvedReaders {
			readers = append(readers, resolvableAssertion{resolver, nil,
				ur.String(), uid})
		}
	}

	newH, err := makeTlfHandleHelper(
		ctx, h.Type(), writers, readers, h.Extensions(), idGetter)
	if err != nil {
		return nil, err
	}

	return newH, nil
}

// ResolveAgain tries to resolve any unresolved assertions in the
// given handle and returns a new handle with the results. As an
// optimization, if h contains no unresolved assertions, it just
// returns itself.
func (h *TlfHandle) ResolveAgain(
	ctx context.Context, resolver resolver, idGetter tlfIDGetter) (
	*TlfHandle, error) {
	if h.IsFinal() {
		// Don't attempt to further resolve final handles.
		return h, nil
	}
	return h.ResolveAgainForUser(ctx, resolver, idGetter, keybase1.UID(""))
}

type partialResolver struct {
	resolver
	unresolvedAssertions map[string]bool
}

func (pr partialResolver) Resolve(ctx context.Context, assertion string) (
	libkb.NormalizedUsername, keybase1.UserOrTeamID, error) {
	if pr.unresolvedAssertions[assertion] {
		// Force an unresolved assertion.
		return libkb.NormalizedUsername(""),
			keybase1.UserOrTeamID(""), NoSuchUserError{assertion}
	}
	return pr.resolver.Resolve(ctx, assertion)
}

// ResolvesTo returns whether this handle resolves to the given one.
// It also returns the partially-resolved version of h, i.e. h
// resolved except for unresolved assertions in other; this should
// equal other if and only if true is returned.
func (h TlfHandle) ResolvesTo(
	ctx context.Context, codec kbfscodec.Codec, resolver resolver,
	idGetter tlfIDGetter, other TlfHandle) (
	resolvesTo bool, partialResolvedH *TlfHandle,
	err error) {
	// Check the conflict extension.
	var conflictAdded, finalizedAdded bool
	if !h.IsConflict() && other.IsConflict() {
		conflictAdded = true
		// Ignore the added extension for resolution comparison purposes.
		other.conflictInfo = nil
	}

	// Check the finalized extension.
	if h.IsFinal() {
		if conflictAdded {
			// Can't add conflict info to a finalized handle.
			return false, nil, TlfHandleFinalizedError{}
		}
	} else if other.IsFinal() {
		finalizedAdded = true
		// Ignore the added extension for resolution comparison purposes.
		other.finalizedInfo = nil
	}

	unresolvedAssertions := make(map[string]bool)
	for _, uw := range other.unresolvedWriters {
		unresolvedAssertions[uw.String()] = true
	}
	for _, ur := range other.unresolvedReaders {
		unresolvedAssertions[ur.String()] = true
	}

	// TODO: Once we keep track of the original assertions in
	// TlfHandle, restrict the resolver to use other's assertions
	// only, so that we don't hit the network at all.
	partialResolvedH, err = h.ResolveAgain(
		ctx, partialResolver{resolver, unresolvedAssertions}, idGetter)
	if err != nil {
		return false, nil, err
	}

	if conflictAdded || finalizedAdded {
		resolvesTo, err = partialResolvedH.EqualsIgnoreName(codec, other)
	} else {
		resolvesTo, err = partialResolvedH.Equals(codec, other)
	}
	if err != nil {
		return false, nil, err
	}

	return resolvesTo, partialResolvedH, nil
}

// MutuallyResolvesTo checks that the target handle, and the provided
// `other` handle, resolve to each other.
func (h TlfHandle) MutuallyResolvesTo(
	ctx context.Context, codec kbfscodec.Codec,
	resolver resolver, idGetter tlfIDGetter, other TlfHandle,
	rev kbfsmd.Revision, tlfID tlf.ID, log logger.Logger) error {
	handleResolvesToOther, partialResolvedHandle, err :=
		h.ResolvesTo(ctx, codec, resolver, idGetter, other)
	if err != nil {
		return err
	}

	// TODO: If h has conflict info, other should, too.
	otherResolvesToHandle, partialResolvedOther, err :=
		other.ResolvesTo(ctx, codec, resolver, idGetter, h)
	if err != nil {
		return err
	}

	handlePath := h.GetCanonicalPath()
	otherPath := other.GetCanonicalPath()
	if !handleResolvesToOther && !otherResolvesToHandle {
		return MDMismatchError{
			rev, h.GetCanonicalPath(), tlfID,
			fmt.Errorf(
				"MD contained unexpected handle path %s (%s -> %s) (%s -> %s)",
				otherPath,
				h.GetCanonicalPath(),
				partialResolvedHandle.GetCanonicalPath(),
				other.GetCanonicalPath(),
				partialResolvedOther.GetCanonicalPath()),
		}
	}

	if handlePath != otherPath {
		log.CDebugf(ctx, "handle for %s resolved to %s",
			handlePath, otherPath)
	}
	return nil
}

type resolvableAssertionWithChangeReport struct {
	resolvableAssertion
	changed chan struct{}
}

func (ra resolvableAssertionWithChangeReport) resolve(ctx context.Context) (
	nameIDPair, keybase1.SocialAssertion, tlf.ID, error) {
	nuid, sa, tlfID, err := ra.resolvableAssertion.resolve(ctx)
	if err != nil {
		return nameIDPair{}, keybase1.SocialAssertion{}, tlf.NullID, err
	}
	sendIfPossible := func() {
		select {
		case ra.changed <- struct{}{}:
		default:
		}
	}
	if nuid.name.String() != "" {
		if nuid.name.String() != strings.TrimPrefix(ra.assertion, "team:") {
			sendIfPossible()
		}
	} else if sa != (keybase1.SocialAssertion{}) {
		if sa.String() != ra.assertion {
			sendIfPossible()
		}
	}
	return nuid, sa, tlfID, nil
}

type resolvableAssertion struct {
	resolver   resolver
	identifier identifier // only needed until KBFS-2022 is fixed
	assertion  string
	mustBeUser keybase1.UID
}

func (ra resolvableAssertion) resolve(ctx context.Context) (
	nameIDPair, keybase1.SocialAssertion, tlf.ID, error) {
	if ra.assertion == PublicUIDName {
		return nameIDPair{}, keybase1.SocialAssertion{}, tlf.NullID,
			fmt.Errorf("Invalid name %s", ra.assertion)
	}
	name, id, err := ra.resolver.Resolve(ctx, ra.assertion)
	if err == nil && ra.mustBeUser != keybase1.UID("") &&
		ra.mustBeUser.AsUserOrTeam() != id {
		// Force an unresolved assertion sinced the forced user doesn't match
		err = NoSuchUserError{ra.assertion}
	}
	// The service's Resolve2 doesn't handle compound assertions
	// correctly because it would rely too much on server trust.  It
	// just resolves the first component, so something like
	// "strib+therealdonaldtrump@twitter" would actually resolve
	// correctly.  So we need to do an explicit identify in that case,
	// at least until KBFS-2022 is finished.  Note that this
	// explicitly avoids checking any of the extended identify context
	// info, since we need to do this regardless of what the
	// originator wants.
	if strings.Contains(ra.assertion, "+") {
		if ra.identifier == nil {
			return nameIDPair{}, keybase1.SocialAssertion{}, tlf.NullID,
				errors.New(
					"Can't resolve an AND assertion without an identifier")
		}
		reason := fmt.Sprintf("You accessed a folder with %s.", ra.assertion)
		var resName libkb.NormalizedUsername
		resName, _, err = ra.identifier.Identify(ctx, ra.assertion, reason)
		if err == nil && resName != name {
			return nameIDPair{}, keybase1.SocialAssertion{}, tlf.NullID,
				fmt.Errorf(
					"Resolved name %s doesn't match identified name %s for "+
						"assertion %s", name, resName, ra.assertion)
		}
	}
	switch err := err.(type) {
	default:
		return nameIDPair{}, keybase1.SocialAssertion{}, tlf.NullID, err
	case nil:
		return nameIDPair{
			name: name,
			id:   id,
		}, keybase1.SocialAssertion{}, tlf.NullID, nil
	case NoSuchUserError:
		socialAssertion, ok := externals.NormalizeSocialAssertion(ra.assertion)
		if !ok {
			return nameIDPair{}, keybase1.SocialAssertion{}, tlf.NullID, err
		}
		return nameIDPair{}, socialAssertion, tlf.NullID, nil
	}
}

type resolvableImplicitTeam struct {
	resolver resolver
	name     string
	tlfType  tlf.Type
}

func (rit resolvableImplicitTeam) resolve(ctx context.Context) (
	nameIDPair, keybase1.SocialAssertion, tlf.ID, error) {
	// Need to separate the extension from the assertions.
	assertions, extensionSuffix, err := tlf.SplitExtension(rit.name)
	if err != nil {
		return nameIDPair{}, keybase1.SocialAssertion{}, tlf.NullID, err
	}

	iteamInfo, err := rit.resolver.ResolveImplicitTeam(
		ctx, assertions, extensionSuffix, rit.tlfType)
	if err != nil {
		return nameIDPair{}, keybase1.SocialAssertion{}, tlf.NullID, err
	}

	return nameIDPair{
		name: iteamInfo.Name,
		id:   iteamInfo.TID.AsUserOrTeam(),
	}, keybase1.SocialAssertion{}, iteamInfo.TlfID, nil
}

// parseTlfHandleLoose parses a TLF handle but leaves some of the canonicality
// checking to public routines like ParseTlfHandle and ParseTlfHandlePreferred.
func parseTlfHandleLoose(
	ctx context.Context, kbpki KBPKI, idGetter tlfIDGetter, name string,
	t tlf.Type) (*TlfHandle, error) {
	writerNames, readerNames, extensionSuffix, err :=
		splitAndNormalizeTLFName(name, t)
	if err != nil {
		return nil, err
	}

	// First try resolving this full name as an implicit team.  If
	// that doesn't work, fall through to individual name resolution.
	rit := resolvableImplicitTeam{kbpki, name, t}
	iteamHandle, err := makeTlfHandleHelper(
		ctx, t, []resolvableUser{rit}, nil, nil, idGetter)
	if err == nil && iteamHandle.tlfID != tlf.NullID {
		// The iteam already has a TLF ID, let's use it.
		return iteamHandle, nil
	}
	// This is not an implicit team, so continue on to check for a
	// normal team.  TODO: return non-nil errors immediately if they
	// don't simply indicate the implicit team doesn't exist yet
	// (i.e., when we start creating them by default).

	// Before parsing the tlf handle (which results in identify
	// calls that cause tracker popups), first see if there's any
	// quick normalization of usernames we can do.  For example,
	// this avoids an identify in the case of "HEAD" which might
	// just be a shell trying to look for a git repo rather than a
	// real user lookup for "head" (KBFS-531).  Note that the name
	// might still contain assertions, which will result in
	// another alias in a subsequent lookup.
	// This also contains an offline check for canonicality and
	// whether a public folder has readers.
	changesCh := make(chan struct{}, 1)
	writers := make([]resolvableUser, len(writerNames))
	for i, w := range writerNames {
		if t == tlf.SingleTeam {
			w = "team:" + w
		}
		writers[i] = resolvableAssertionWithChangeReport{
			resolvableAssertion{kbpki, kbpki, w, keybase1.UID("")}, changesCh}
	}
	readers := make([]resolvableUser, len(readerNames))
	for i, r := range readerNames {
		readers[i] = resolvableAssertionWithChangeReport{
			resolvableAssertion{kbpki, kbpki, r, keybase1.UID("")}, changesCh}
	}

	var extensions []tlf.HandleExtension
	if len(extensionSuffix) != 0 {
		extensions, err = tlf.ParseHandleExtensionSuffix(extensionSuffix)
		if err != nil {
			return nil, err
		}
	}

	h, err := makeTlfHandleHelper(
		ctx, t, writers, readers, extensions, idGetter)
	if err != nil {
		return nil, err
	}

	// TODO(KBFS-2621): When we want to start creating new implicit
	// team TLFs, and h.tlfID is null, return `iteamHandle` instead of
	// `h`.

	if t == tlf.Private {
		session, err := kbpki.GetCurrentSession(ctx)
		if err != nil {
			return nil, err
		}

		if !h.IsReader(session.UID) {
			return nil, NewReadAccessError(h, session.Name, h.GetCanonicalPath())
		}
	}

	if extensionSuffix != "" {
		extensionList := tlf.HandleExtensionList(extensions)
		sort.Sort(extensionList)
		var canonExtensionString = extensionList.Suffix()
		if canonExtensionString != tlf.HandleExtensionSep+extensionSuffix {
			return nil, TlfNameNotCanonical{name, string(h.GetCanonicalName())}
		}
	}

	select {
	case <-changesCh:
	default:
		// No changes were performed because of resolver.
		return h, nil
	}

	// Otherwise, identify before returning the canonical name.
	err = identifyHandle(ctx, kbpki, kbpki, h)
	if err != nil {
		return nil, err
	}

	// In this case return both the handle and the error,
	// ParseTlfHandlePreferred uses this to make the redirection
	// better.
	return h, TlfNameNotCanonical{name, string(h.GetCanonicalName())}
}

// ParseTlfHandle parses a TlfHandle from an encoded string. See
// TlfHandle.GetCanonicalName() for the opposite direction.
//
// Some errors that may be returned and can be specially handled:
//
// TlfNameNotCanonical: Returned when the given name is not canonical
// -- another name to try (which itself may not be canonical) is in
// the error. Usually, you want to treat this as a symlink to the name
// to try.
//
// NoSuchNameError: Returned when public is set and the given folder
// has no public folder.
//
// TODO In future perhaps all code should switch over to preferred handles,
// and rename TlfNameNotCanonical to TlfNameNotPreferred.
func ParseTlfHandle(
	ctx context.Context, kbpki KBPKI, idGetter tlfIDGetter, name string,
	t tlf.Type) (*TlfHandle, error) {
	h, err := parseTlfHandleLoose(ctx, kbpki, idGetter, name, t)
	if err != nil {
		return nil, err
	}
	if name != string(h.GetCanonicalName()) {
		return nil, TlfNameNotCanonical{name, string(h.GetCanonicalName())}
	}
	return h, nil
}

// ParseTlfHandlePreferred returns TlfNameNotCanonical if not
// in the preferred format.
// Preferred format means that the users own username (from kbpki)
// as a writer is put before other usernames in the tlf name.
// i.e.
// Canon            Preferred
// myname,other     myname,other
// another,myname   myname,another
// This function also can return NoSuchNameError or TlfNameNotCanonical.
// TlfNameNotCanonical is returned from this function when the name is
// not the *preferred* name.
func ParseTlfHandlePreferred(
	ctx context.Context, kbpki KBPKI, idGetter tlfIDGetter, name string,
	t tlf.Type) (*TlfHandle, error) {
	h, err := parseTlfHandleLoose(ctx, kbpki, idGetter, name, t)
	// Return an early if there is an error, except in the case
	// where both h is not nil and it is a TlfNameNotCanonicalError.
	// In that case continue and return TlfNameNotCanonical later
	// with the right symlink target.
	if err != nil && (h == nil || !isTlfNameNotCanonical(err)) {
		return nil, err
	}
	session, err := GetCurrentSessionIfPossible(
		ctx, kbpki, h.Type() == tlf.Public)
	if err != nil {
		return nil, err
	}
	pref := h.GetPreferredFormat(session.Name)
	if string(pref) != name {
		return nil, TlfNameNotCanonical{name, string(pref)}
	}
	return h, nil
}

func isTlfNameNotCanonical(err error) bool {
	_, ok := err.(TlfNameNotCanonical)
	return ok
}
