// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

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

// CanonicalTlfName is a string containing the canonical name of a TLF.
type CanonicalTlfName string

// TlfHandle contains all the info in a BareTlfHandle as well as
// additional info. This doesn't embed BareTlfHandle to avoid having
// to keep track of data in multiple places.
type TlfHandle struct {
	// If this is true, resolvedReaders and unresolvedReaders
	// should both be nil.
	public          bool
	resolvedWriters map[keybase1.UID]libkb.NormalizedUsername
	resolvedReaders map[keybase1.UID]libkb.NormalizedUsername
	// Both unresolvedWriters and unresolvedReaders are stored in
	// sorted order.
	unresolvedWriters []keybase1.SocialAssertion
	unresolvedReaders []keybase1.SocialAssertion
	conflictInfo      *TlfHandleExtension
	finalizedInfo     *TlfHandleExtension
	// name can be computed from the other fields, but is cached
	// for speed.
	name CanonicalTlfName
}

// IsPublic returns whether or not this TlfHandle represents a public
// top-level folder.
func (h TlfHandle) IsPublic() bool {
	return h.public
}

// IsWriter returns whether or not the given user is a writer for the
// top-level folder represented by this TlfHandle.
func (h TlfHandle) IsWriter(user keybase1.UID) bool {
	_, ok := h.resolvedWriters[user]
	return ok
}

// IsReader returns whether or not the given user is a reader for the
// top-level folder represented by this TlfHandle.
func (h TlfHandle) IsReader(user keybase1.UID) bool {
	if h.public || h.IsWriter(user) {
		return true
	}
	_, ok := h.resolvedReaders[user]
	return ok
}

func (h TlfHandle) unsortedResolvedWriters() []keybase1.UID {
	if len(h.resolvedWriters) == 0 {
		return nil
	}
	writers := make([]keybase1.UID, 0, len(h.resolvedWriters))
	for r := range h.resolvedWriters {
		writers = append(writers, r)
	}
	return writers
}

// ResolvedWriters returns the handle's resolved writer UIDs in sorted
// order.
func (h TlfHandle) ResolvedWriters() []keybase1.UID {
	writers := h.unsortedResolvedWriters()
	sort.Sort(uidList(writers))
	return writers
}

// FirstResolvedWriter returns the handle's first resolved writer UID
// (when sorted). This is used mostly for tests.
func (h TlfHandle) FirstResolvedWriter() keybase1.UID {
	return h.ResolvedWriters()[0]
}

func (h TlfHandle) unsortedResolvedReaders() []keybase1.UID {
	if len(h.resolvedReaders) == 0 {
		return nil
	}
	readers := make([]keybase1.UID, 0, len(h.resolvedReaders))
	for r := range h.resolvedReaders {
		readers = append(readers, r)
	}
	return readers
}

// ResolvedReaders returns the handle's resolved reader UIDs in sorted
// order. If the handle is public, nil will be returned.
func (h TlfHandle) ResolvedReaders() []keybase1.UID {
	readers := h.unsortedResolvedReaders()
	sort.Sort(uidList(readers))
	return readers
}

// UnresolvedWriters returns the handle's unresolved writers in sorted
// order.
func (h TlfHandle) UnresolvedWriters() []keybase1.SocialAssertion {
	if len(h.unresolvedWriters) == 0 {
		return nil
	}
	unresolvedWriters := make([]keybase1.SocialAssertion, len(h.unresolvedWriters))
	copy(unresolvedWriters, h.unresolvedWriters)
	return unresolvedWriters
}

// UnresolvedReaders returns the handle's unresolved readers in sorted
// order. If the handle is public, nil will be returned.
func (h TlfHandle) UnresolvedReaders() []keybase1.SocialAssertion {
	if len(h.unresolvedReaders) == 0 {
		return nil
	}
	unresolvedReaders := make([]keybase1.SocialAssertion, len(h.unresolvedReaders))
	copy(unresolvedReaders, h.unresolvedReaders)
	return unresolvedReaders
}

// ConflictInfo returns the handle's conflict info, if any.
func (h TlfHandle) ConflictInfo() *TlfHandleExtension {
	if h.conflictInfo == nil {
		return nil
	}
	conflictInfoCopy := *h.conflictInfo
	return &conflictInfoCopy
}

func (h TlfHandle) recomputeNameWithExtensions() CanonicalTlfName {
	components := strings.Split(string(h.name), TlfHandleExtensionSep)
	newName := components[0]
	extensionList := tlfHandleExtensionList(h.Extensions())
	sort.Sort(extensionList)
	newName += extensionList.Suffix()
	return CanonicalTlfName(newName)
}

// WithUpdatedConflictInfo returns a new handle with the conflict info set to
// the given one, if the existing one is nil. (In this case, the given one may
// also be nil.) Otherwise, the given conflict info must match the existing
// one.
func (h TlfHandle) WithUpdatedConflictInfo(
	codec kbfscodec.Codec, info *TlfHandleExtension) (*TlfHandle, error) {
	newHandle := h.deepCopy()
	if newHandle.conflictInfo == nil {
		if info == nil {
			// Nothing to do.
			return newHandle, nil
		}
		conflictInfoCopy := *info
		newHandle.conflictInfo = &conflictInfoCopy
		newHandle.name = newHandle.recomputeNameWithExtensions()
		return newHandle, nil
	}
	// Make sure conflict info is the same; the conflict info for
	// a TLF, once set, is immutable and should never change.
	equal, err := kbfscodec.Equal(codec, newHandle.conflictInfo, info)
	if err != nil {
		return newHandle, err
	}
	if !equal {
		return newHandle, TlfHandleExtensionMismatchError{
			Expected: *newHandle.ConflictInfo(),
			Actual:   info,
		}
	}
	return newHandle, nil
}

// FinalizedInfo returns the handle's finalized info, if any.
func (h TlfHandle) FinalizedInfo() *TlfHandleExtension {
	if h.finalizedInfo == nil {
		return nil
	}
	finalizedInfoCopy := *h.finalizedInfo
	return &finalizedInfoCopy
}

// SetFinalizedInfo sets the handle's finalized info to the given one,
// which may be nil.
// TODO: remove this to make TlfHandle fully immutable
func (h *TlfHandle) SetFinalizedInfo(info *TlfHandleExtension) {
	if info == nil {
		h.finalizedInfo = nil
	} else {
		finalizedInfoCopy := *info
		h.finalizedInfo = &finalizedInfoCopy
	}
	h.name = h.recomputeNameWithExtensions()
}

// Extensions returns a list of extensions for the given handle.
func (h TlfHandle) Extensions() (extensions []TlfHandleExtension) {
	if h.ConflictInfo() != nil {
		extensions = append(extensions, *h.ConflictInfo())
	}
	if h.FinalizedInfo() != nil {
		extensions = append(extensions, *h.FinalizedInfo())
	}
	return extensions
}

func init() {
	if reflect.ValueOf(TlfHandle{}).NumField() != 8 {
		panic(errors.New(
			"Unexpected number of fields in TlfHandle; " +
				"please update TlfHandle.Equals() for your " +
				"new or removed field"))
	}
}

// EqualsIgnoreName returns whether h and other contain the same info ignoring the name.
func (h TlfHandle) EqualsIgnoreName(
	codec kbfscodec.Codec, other TlfHandle) (bool, error) {
	if h.public != other.public {
		return false, nil
	}

	if !reflect.DeepEqual(h.resolvedWriters, other.resolvedWriters) {
		return false, nil
	}

	if !reflect.DeepEqual(h.resolvedReaders, other.resolvedReaders) {
		return false, nil
	}

	if !reflect.DeepEqual(h.unresolvedWriters, other.unresolvedWriters) {
		return false, nil
	}

	if !reflect.DeepEqual(h.unresolvedReaders, other.unresolvedReaders) {
		return false, nil
	}

	eq, err := kbfscodec.Equal(codec, h.conflictInfo, other.conflictInfo)
	if err != nil {
		return false, err
	}
	if !eq {
		return false, nil
	}

	eq, err = kbfscodec.Equal(codec, h.finalizedInfo, other.finalizedInfo)
	if err != nil {
		return false, err
	}
	return eq, nil
}

// Equals returns whether h and other contain the same info.
func (h TlfHandle) Equals(
	codec kbfscodec.Codec, other TlfHandle) (bool, error) {
	eq, err := h.EqualsIgnoreName(codec, other)
	if err != nil {
		return false, err
	}

	if eq && h.name != other.name {
		panic(fmt.Errorf(
			"%+v equals %+v in everything but name", h, other))
	}

	return eq, nil
}

// ToBareHandle returns a BareTlfHandle corresponding to this handle.
func (h TlfHandle) ToBareHandle() (BareTlfHandle, error) {
	var readers []keybase1.UID
	if h.public {
		readers = []keybase1.UID{keybase1.PUBLIC_UID}
	} else {
		readers = h.unsortedResolvedReaders()
	}
	return MakeBareTlfHandle(
		h.unsortedResolvedWriters(), readers,
		h.unresolvedWriters, h.unresolvedReaders,
		h.Extensions())
}

// ToBareHandleOrBust returns a BareTlfHandle corresponding to this
// handle, and panics if there's an error. Used by tests.
func (h TlfHandle) ToBareHandleOrBust() BareTlfHandle {
	bh, err := h.ToBareHandle()
	if err != nil {
		panic(err)
	}
	return bh
}

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
	extensions []TlfHandleExtension) (*TlfHandle, error) {
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

	extensionList := tlfHandleExtensionList(extensions)
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

// MakeTlfHandle creates a TlfHandle from the given BareTlfHandle and
// the given normalizedUsernameGetter (which is usually a KBPKI).
func MakeTlfHandle(
	ctx context.Context, bareHandle BareTlfHandle,
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

func (h TlfHandle) deepCopy() *TlfHandle {
	hCopy := TlfHandle{
		public:            h.public,
		name:              h.name,
		unresolvedWriters: h.UnresolvedWriters(),
		unresolvedReaders: h.UnresolvedReaders(),
		conflictInfo:      h.ConflictInfo(),
		finalizedInfo:     h.FinalizedInfo(),
	}

	hCopy.resolvedWriters = make(map[keybase1.UID]libkb.NormalizedUsername, len(h.resolvedWriters))
	for k, v := range h.resolvedWriters {
		hCopy.resolvedWriters[k] = v
	}

	hCopy.resolvedReaders = make(map[keybase1.UID]libkb.NormalizedUsername, len(h.resolvedReaders))
	for k, v := range h.resolvedReaders {
		hCopy.resolvedReaders[k] = v
	}

	return &hCopy
}

func getSortedNames(
	uidToName map[keybase1.UID]libkb.NormalizedUsername,
	unresolved []keybase1.SocialAssertion) []string {
	var names []string
	for _, name := range uidToName {
		names = append(names, name.String())
	}
	for _, sa := range unresolved {
		names = append(names, sa.String())
	}
	sort.Sort(sort.StringSlice(names))
	return names
}

// GetCanonicalName returns the canonical name of this TLF.
func (h *TlfHandle) GetCanonicalName() CanonicalTlfName {
	if h.name == "" {
		panic(fmt.Sprintf("TlfHandle %v with no name", h))
	}

	return h.name
}

// GetCanonicalPath returns the full canonical path of this TLF.
func (h *TlfHandle) GetCanonicalPath() string {
	return buildCanonicalPathForTlfName(h.IsPublic(), h.GetCanonicalName())
}

// ToFavorite converts a TlfHandle into a Favorite, suitable for
// Favorites calls.
func (h *TlfHandle) ToFavorite() Favorite {
	return Favorite{
		Name:   string(h.GetCanonicalName()),
		Public: h.IsPublic(),
	}
}

// ToFavorite converts a TlfHandle into a Favorite, and sets internal
// state about whether the corresponding folder was just created or
// not.
func (h *TlfHandle) toFavToAdd(created bool) favToAdd {
	return favToAdd{
		Favorite: h.ToFavorite(),
		created:  created,
	}
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
		writers = append(writers, resolvableAssertion{resolver,
			uw.String(), uid})
	}

	var readers []resolvableUser
	if !h.IsPublic() {
		readers = make([]resolvableUser, 0, len(h.resolvedReaders)+len(h.unresolvedReaders))
		for uid, r := range h.resolvedReaders {
			readers = append(readers, resolvableNameUIDPair{r, uid})
		}
		for _, ur := range h.unresolvedReaders {
			readers = append(readers, resolvableAssertion{resolver,
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

func getSortedUnresolved(unresolved map[keybase1.SocialAssertion]bool) []keybase1.SocialAssertion {
	var assertions []keybase1.SocialAssertion
	for sa := range unresolved {
		assertions = append(assertions, sa)
	}
	sort.Sort(socialAssertionList(assertions))
	return assertions
}

func splitAndNormalizeTLFName(name string, public bool) (
	writerNames, readerNames []string,
	extensionSuffix string, err error) {

	names := strings.SplitN(name, TlfHandleExtensionSep, 2)
	if len(names) > 2 {
		return nil, nil, "", BadTLFNameError{name}
	}
	if len(names) > 1 {
		extensionSuffix = names[1]
	}

	splitNames := strings.SplitN(names[0], ReaderSep, 3)
	if len(splitNames) > 2 {
		return nil, nil, "", BadTLFNameError{name}
	}
	writerNames = strings.Split(splitNames[0], ",")
	if len(splitNames) > 1 {
		readerNames = strings.Split(splitNames[1], ",")
	}

	hasPublic := len(readerNames) == 0

	if public && !hasPublic {
		// No public folder exists for this folder.
		return nil, nil, "", NoSuchNameError{Name: name}
	}

	normalizedName, err := normalizeNamesInTLF(
		writerNames, readerNames, extensionSuffix)
	if err != nil {
		return nil, nil, "", err
	}
	if normalizedName != name {
		return nil, nil, "", TlfNameNotCanonical{name, normalizedName}
	}

	return writerNames, readerNames, strings.ToLower(extensionSuffix), nil
}

// TODO: this function can likely be replaced with a call to
// AssertionParseAndOnly when CORE-2967 and CORE-2968 are fixed.
func normalizeAssertionOrName(s string) (string, error) {
	if libkb.CheckUsername.F(s) {
		return libkb.NewNormalizedUsername(s).String(), nil
	}

	// TODO: this fails for http and https right now (see CORE-2968).
	socialAssertion, isSocialAssertion := externals.NormalizeSocialAssertion(s)
	if isSocialAssertion {
		return socialAssertion.String(), nil
	}

	if expr, err := externals.AssertionParseAndOnly(s); err == nil {
		// If the expression only contains a single url, make sure
		// it's not a just considered a single keybase username.  If
		// it is, then some non-username slipped into the default
		// "keybase" case and should be considered an error.
		urls := expr.CollectUrls(nil)
		if len(urls) == 1 && urls[0].IsKeybase() {
			return "", NoSuchUserError{s}
		}

		// Normalize and return.  Ideally `AssertionParseAndOnly`
		// would normalize for us, but that doesn't work yet, so for
		// now we'll just lower-case.  This will incorrectly lower
		// case http/https/web assertions, as well as case-sensitive
		// social assertions in AND expressions.  TODO: see CORE-2967.
		return strings.ToLower(s), nil
	}

	return "", BadTLFNameError{s}
}

// normalizeNamesInTLF takes a split TLF name and, without doing any
// resolutions or identify calls, normalizes all elements of the
// name. It then returns the normalized name.
func normalizeNamesInTLF(writerNames, readerNames []string,
	extensionSuffix string) (string, error) {
	sortedWriterNames := make([]string, len(writerNames))
	var err error
	for i, w := range writerNames {
		sortedWriterNames[i], err = normalizeAssertionOrName(w)
		if err != nil {
			return "", err
		}
	}
	sort.Strings(sortedWriterNames)
	normalizedName := strings.Join(sortedWriterNames, ",")
	if len(readerNames) > 0 {
		sortedReaderNames := make([]string, len(readerNames))
		for i, r := range readerNames {
			sortedReaderNames[i], err = normalizeAssertionOrName(r)
			if err != nil {
				return "", err
			}
		}
		sort.Strings(sortedReaderNames)
		normalizedName += ReaderSep + strings.Join(sortedReaderNames, ",")
	}
	if len(extensionSuffix) != 0 {
		// This *should* be normalized already but make sure.  I can see not
		// doing so might surprise a caller.
		normalizedName += TlfHandleExtensionSep + strings.ToLower(extensionSuffix)
	}

	return normalizedName, nil
}

type resolvableAssertion struct {
	resolver   resolver
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
func ParseTlfHandle(
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
	writerNames, readerNames, extensionSuffix, err :=
		splitAndNormalizeTLFName(name, public)
	if err != nil {
		return nil, err
	}

	hasPublic := len(readerNames) == 0

	if public && !hasPublic {
		// No public folder exists for this folder.
		return nil, NoSuchNameError{Name: name}
	}

	normalizedName, err := normalizeNamesInTLF(
		writerNames, readerNames, extensionSuffix)
	if err != nil {
		return nil, err
	}
	if normalizedName != name {
		return nil, TlfNameNotCanonical{name, normalizedName}
	}

	writers := make([]resolvableUser, len(writerNames))
	for i, w := range writerNames {
		writers[i] = resolvableAssertion{kbpki, w, keybase1.UID("")}
	}
	readers := make([]resolvableUser, len(readerNames))
	for i, r := range readerNames {
		readers[i] = resolvableAssertion{kbpki, r, keybase1.UID("")}
	}

	var extensions []TlfHandleExtension
	if len(extensionSuffix) != 0 {
		extensions, err = ParseTlfHandleExtensionSuffix(extensionSuffix)
		if err != nil {
			return nil, err
		}
	}

	h, err := makeTlfHandleHelper(ctx, public, writers, readers, extensions)
	if err != nil {
		return nil, err
	}

	if !public {
		currentUsername, currentUID, err := kbpki.GetCurrentUserInfo(ctx)
		if err != nil {
			return nil, err
		}

		if !h.IsReader(currentUID) {
			return nil, ReadAccessError{currentUsername, h.GetCanonicalName(), public}
		}
	}

	if string(h.GetCanonicalName()) == name {
		// Name is already canonical (i.e., all usernames and
		// no assertions) so we can delay the identify until
		// the node is actually used.
		return h, nil
	}

	// Otherwise, identify before returning the canonical name.
	err = identifyHandle(ctx, kbpki, kbpki, h)
	if err != nil {
		return nil, err
	}

	return nil, TlfNameNotCanonical{name, string(h.GetCanonicalName())}
}

// CheckTlfHandleOffline does light checks whether a TLF handle looks ok,
// it avoids all network calls.
func CheckTlfHandleOffline(
	ctx context.Context, name string, public bool) error {
	_, _, _, err := splitAndNormalizeTLFName(name, public)
	return err
}

// IsFinal returns whether or not this TlfHandle represents a finalized
// top-level folder.
func (h TlfHandle) IsFinal() bool {
	return h.finalizedInfo != nil
}

// IsConflict returns whether or not this TlfHandle represents a conflicted
// top-level folder.
func (h TlfHandle) IsConflict() bool {
	return h.conflictInfo != nil
}
