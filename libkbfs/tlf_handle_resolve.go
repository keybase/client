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
	"github.com/keybase/kbfs/tlf"
	"golang.org/x/net/context"
)

type nameUIDPair struct {
	name libkb.NormalizedUsername
	uid  keybase1.UID
}

type resolvableUser interface {
	// resolve must do exactly one of the following:
	//
	//   - return a non-zero nameUIDPair;
	//   - return a non-zero keybase1.SocialAssertion;
	//   - return a non-nil error.
	resolve(context.Context) (nameUIDPair, keybase1.SocialAssertion, error)
}

func resolveOneUser(
	ctx context.Context, user resolvableUser,
	errCh chan<- error, userInfoResults chan<- nameUIDPair,
	socialAssertionResults chan<- keybase1.SocialAssertion) {
	userInfo, socialAssertion, err := user.resolve(ctx)
	if err != nil {
		select {
		case errCh <- err:
		default:
			// another worker reported an error before us;
			// first one wins
		}
		return
	}
	if userInfo != (nameUIDPair{}) {
		userInfoResults <- userInfo
		return
	}

	if socialAssertion != (keybase1.SocialAssertion{}) {
		socialAssertionResults <- socialAssertion
		return
	}

	errCh <- fmt.Errorf("Resolving %v resulted in empty userInfo and empty socialAssertion", user)
}

func makeTlfHandleHelper(
	ctx context.Context, public bool, writers, readers []resolvableUser,
	extensions []tlf.HandleExtension) (*TlfHandle, error) {
	if public && len(readers) > 0 {
		return nil, errors.New("public folder cannot have readers")
	}

	// parallelize the resolutions for each user
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	errCh := make(chan error, 1)

	wc := make(chan nameUIDPair, len(writers))
	uwc := make(chan keybase1.SocialAssertion, len(writers))
	for _, writer := range writers {
		go resolveOneUser(ctx, writer, errCh, wc, uwc)
	}

	rc := make(chan nameUIDPair, len(readers))
	urc := make(chan keybase1.SocialAssertion, len(readers))
	for _, reader := range readers {
		go resolveOneUser(ctx, reader, errCh, rc, urc)
	}

	usedWNames := make(map[keybase1.UID]libkb.NormalizedUsername, len(writers))
	usedRNames := make(map[keybase1.UID]libkb.NormalizedUsername, len(readers))
	usedUnresolvedWriters := make(map[keybase1.SocialAssertion]bool)
	usedUnresolvedReaders := make(map[keybase1.SocialAssertion]bool)
	for i := 0; i < len(writers)+len(readers); i++ {
		select {
		case err := <-errCh:
			return nil, err
		case userInfo := <-wc:
			usedWNames[userInfo.uid] = userInfo.name
		case userInfo := <-rc:
			usedRNames[userInfo.uid] = userInfo.name
		case socialAssertion := <-uwc:
			usedUnresolvedWriters[socialAssertion] = true
		case socialAssertion := <-urc:
			usedUnresolvedReaders[socialAssertion] = true
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}

	for uid := range usedWNames {
		delete(usedRNames, uid)
	}

	for sa := range usedUnresolvedWriters {
		delete(usedUnresolvedReaders, sa)
	}

	unresolvedWriters := getSortedUnresolved(usedUnresolvedWriters)

	var unresolvedReaders []keybase1.SocialAssertion
	if !public {
		unresolvedReaders = getSortedUnresolved(usedUnresolvedReaders)
	}

	writerNames := getSortedNames(usedWNames, unresolvedWriters)
	canonicalName := strings.Join(writerNames, ",")
	if !public && len(usedRNames)+len(unresolvedReaders) > 0 {
		readerNames := getSortedNames(usedRNames, unresolvedReaders)
		canonicalName += ReaderSep + strings.Join(readerNames, ",")
	}

	extensionList := tlf.HandleExtensionList(extensions)
	sort.Sort(extensionList)
	canonicalName += extensionList.Suffix()
	conflictInfo, finalizedInfo := extensionList.Splat()

	h := &TlfHandle{
		public:            public,
		resolvedWriters:   usedWNames,
		resolvedReaders:   usedRNames,
		unresolvedWriters: unresolvedWriters,
		unresolvedReaders: unresolvedReaders,
		conflictInfo:      conflictInfo,
		finalizedInfo:     finalizedInfo,
		name:              CanonicalTlfName(canonicalName),
	}

	return h, nil
}

type resolvableUID struct {
	nug normalizedUsernameGetter
	uid keybase1.UID
}

func (ruid resolvableUID) resolve(ctx context.Context) (nameUIDPair, keybase1.SocialAssertion, error) {
	name, err := ruid.nug.GetNormalizedUsername(ctx, ruid.uid)
	if err != nil {
		return nameUIDPair{}, keybase1.SocialAssertion{}, err
	}
	return nameUIDPair{
		name: name,
		uid:  ruid.uid,
	}, keybase1.SocialAssertion{}, nil
}

type resolvableSocialAssertion keybase1.SocialAssertion

func (rsa resolvableSocialAssertion) resolve(ctx context.Context) (nameUIDPair, keybase1.SocialAssertion, error) {
	return nameUIDPair{}, keybase1.SocialAssertion(rsa), nil
}

// MakeTlfHandle creates a TlfHandle from the given tlf.Handle and the
// given normalizedUsernameGetter (which is usually a KBPKI).
func MakeTlfHandle(
	ctx context.Context, bareHandle tlf.Handle,
	nug normalizedUsernameGetter) (*TlfHandle, error) {
	writers := make([]resolvableUser, 0, len(bareHandle.Writers)+len(bareHandle.UnresolvedWriters))
	for _, w := range bareHandle.Writers {
		writers = append(writers, resolvableUID{nug, w})
	}
	for _, uw := range bareHandle.UnresolvedWriters {
		writers = append(writers, resolvableSocialAssertion(uw))
	}

	var readers []resolvableUser
	if !bareHandle.IsPublic() {
		readers = make([]resolvableUser, 0, len(bareHandle.Readers)+len(bareHandle.UnresolvedReaders))
		for _, r := range bareHandle.Readers {
			readers = append(readers, resolvableUID{nug, r})
		}
		for _, ur := range bareHandle.UnresolvedReaders {
			readers = append(readers, resolvableSocialAssertion(ur))
		}
	}

	h, err := makeTlfHandleHelper(ctx, bareHandle.IsPublic(), writers, readers, bareHandle.Extensions())
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

type resolvableNameUIDPair nameUIDPair

func (rp resolvableNameUIDPair) resolve(ctx context.Context) (nameUIDPair, keybase1.SocialAssertion, error) {
	return nameUIDPair(rp), keybase1.SocialAssertion{}, nil
}

// ResolveAgainForUser tries to resolve any unresolved assertions in
// the given handle and returns a new handle with the results. As an
// optimization, if h contains no unresolved assertions, it just
// returns itself.  If uid != keybase1.UID(""), it only allows
// assertions that resolve to uid.
func (h *TlfHandle) ResolveAgainForUser(ctx context.Context, resolver resolver,
	uid keybase1.UID) (*TlfHandle, error) {
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
	if !h.IsPublic() {
		readers = make([]resolvableUser, 0, len(h.resolvedReaders)+len(h.unresolvedReaders))
		for uid, r := range h.resolvedReaders {
			readers = append(readers, resolvableNameUIDPair{r, uid})
		}
		for _, ur := range h.unresolvedReaders {
			readers = append(readers, resolvableAssertion{resolver, nil,
				ur.String(), uid})
		}
	}

	newH, err := makeTlfHandleHelper(ctx, h.IsPublic(), writers, readers, h.Extensions())
	if err != nil {
		return nil, err
	}

	return newH, nil
}

// ResolveAgain tries to resolve any unresolved assertions in the
// given handle and returns a new handle with the results. As an
// optimization, if h contains no unresolved assertions, it just
// returns itself.
func (h *TlfHandle) ResolveAgain(ctx context.Context, resolver resolver) (
	*TlfHandle, error) {
	if h.IsFinal() {
		// Don't attempt to further resolve final handles.
		return h, nil
	}
	return h.ResolveAgainForUser(ctx, resolver, keybase1.UID(""))
}

type partialResolver struct {
	unresolvedAssertions map[string]bool
	delegate             resolver
}

func (pr partialResolver) Resolve(ctx context.Context, assertion string) (
	libkb.NormalizedUsername, keybase1.UID, error) {
	if pr.unresolvedAssertions[assertion] {
		// Force an unresolved assertion.
		return libkb.NormalizedUsername(""),
			keybase1.UID(""), NoSuchUserError{assertion}
	}
	return pr.delegate.Resolve(ctx, assertion)
}

// ResolvesTo returns whether this handle resolves to the given one.
// It also returns the partially-resolved version of h, i.e. h
// resolved except for unresolved assertions in other; this should
// equal other if and only if true is returned.
func (h TlfHandle) ResolvesTo(
	ctx context.Context, codec kbfscodec.Codec, resolver resolver,
	other TlfHandle) (resolvesTo bool, partialResolvedH *TlfHandle,
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
		ctx, partialResolver{unresolvedAssertions, resolver})
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
	resolver resolver, other TlfHandle, rev MetadataRevision, tlfID tlf.ID,
	log logger.Logger) error {
	handleResolvesToOther, partialResolvedHandle, err :=
		h.ResolvesTo(ctx, codec, resolver, other)
	if err != nil {
		return err
	}

	// TODO: If h has conflict info, other should, too.
	otherResolvesToHandle, partialResolvedOther, err :=
		other.ResolvesTo(ctx, codec, resolver, h)
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
	nameUIDPair, keybase1.SocialAssertion, error) {
	nuid, sa, err := ra.resolvableAssertion.resolve(ctx)
	if err != nil {
		return nameUIDPair{}, keybase1.SocialAssertion{}, err
	}
	sendIfPossible := func() {
		select {
		case ra.changed <- struct{}{}:
		default:
		}
	}
	if nuid.name.String() != "" {
		if nuid.name.String() != ra.assertion {
			sendIfPossible()
		}
	} else if sa != (keybase1.SocialAssertion{}) {
		if sa.String() != ra.assertion {
			sendIfPossible()
		}
	}
	return nuid, sa, nil
}

type resolvableAssertion struct {
	resolver   resolver
	identifier identifier // only needed until KBFS-2022 is fixed
	assertion  string
	mustBeUser keybase1.UID
}

func (ra resolvableAssertion) resolve(ctx context.Context) (
	nameUIDPair, keybase1.SocialAssertion, error) {
	if ra.assertion == PublicUIDName {
		return nameUIDPair{}, keybase1.SocialAssertion{}, fmt.Errorf("Invalid name %s", ra.assertion)
	}
	name, uid, err := ra.resolver.Resolve(ctx, ra.assertion)
	if err == nil && ra.mustBeUser != keybase1.UID("") && ra.mustBeUser != uid {
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
			return nameUIDPair{}, keybase1.SocialAssertion{}, errors.New(
				"Can't resolve an AND assertion without an identifier")
		}
		reason := fmt.Sprintf("You accessed a folder with %s.", ra.assertion)
		var ui UserInfo
		ui, err = ra.identifier.Identify(ctx, ra.assertion, reason)
		if err == nil && ui.Name != name {
			return nameUIDPair{}, keybase1.SocialAssertion{}, fmt.Errorf(
				"Resolved name %s doesn't match identified name %s for "+
					"assertion %s", name, ui.Name, ra.assertion)
		}
	}
	switch err := err.(type) {
	default:
		return nameUIDPair{}, keybase1.SocialAssertion{}, err
	case nil:
		return nameUIDPair{
			name: name,
			uid:  uid,
		}, keybase1.SocialAssertion{}, nil
	case NoSuchUserError:
		socialAssertion, ok := externals.NormalizeSocialAssertion(ra.assertion)
		if !ok {
			return nameUIDPair{}, keybase1.SocialAssertion{}, err
		}
		return nameUIDPair{}, socialAssertion, nil
	}
}

// parseTlfHandleLoose parses a TLF handle but leaves some of the canonicality
// checking to public routines like ParseTlfHandle and ParseTlfHandlePreferred.
func parseTlfHandleLoose(
	ctx context.Context, kbpki KBPKI, name string, public bool) (
	*TlfHandle, error) {
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
	writerNames, readerNames, extensionSuffix, err :=
		splitAndNormalizeTLFName(name, public)
	if err != nil {
		return nil, err
	}

	changesCh := make(chan struct{}, 1)
	writers := make([]resolvableUser, len(writerNames))
	for i, w := range writerNames {
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

	h, err := makeTlfHandleHelper(ctx, public, writers, readers, extensions)
	if err != nil {
		return nil, err
	}

	if !public {
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
	ctx context.Context, kbpki KBPKI, name string, public bool) (
	*TlfHandle, error) {
	h, err := parseTlfHandleLoose(ctx, kbpki, name, public)
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
	ctx context.Context, kbpki KBPKI, name string, public bool) (
	*TlfHandle, error) {
	h, err := parseTlfHandleLoose(ctx, kbpki, name, public)
	// Return an early if there is an error, except in the case
	// where both h is not nil and it is a TlfNameNotCanonicalError.
	// In that case continue and return TlfNameNotCanonical later
	// with the right symlink target.
	if err != nil && (h == nil || !isTlfNameNotCanonical(err)) {
		return nil, err
	}
	session, err := GetCurrentSessionIfPossible(ctx, kbpki, h.IsPublic())
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
