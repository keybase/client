// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

// This file has the type for TlfHandles and offline functionality.

import (
	"fmt"
	"reflect"
	"sort"
	"strings"

	"github.com/keybase/client/go/externals"
	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/tlf"
	kbname "github.com/keybase/client/go/kbun"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	"golang.org/x/net/context"
)

// TlfHandle contains all the info in a tlf.Handle as well as
// additional info. This doesn't embed tlf.Handle to avoid having to
// keep track of data in multiple places.
type TlfHandle struct {
	// If this is not Private, resolvedReaders and unresolvedReaders
	// should both be nil.
	tlfType         tlf.Type
	resolvedWriters map[keybase1.UserOrTeamID]kbname.NormalizedUsername
	resolvedReaders map[keybase1.UserOrTeamID]kbname.NormalizedUsername
	// Both unresolvedWriters and unresolvedReaders are stored in
	// sorted order.
	unresolvedWriters []keybase1.SocialAssertion
	unresolvedReaders []keybase1.SocialAssertion
	conflictInfo      *tlf.HandleExtension
	finalizedInfo     *tlf.HandleExtension
	// name can be computed from the other fields, but is cached
	// for speed.
	name tlf.CanonicalName

	// If we know the TLF ID at the time this handle is constructed
	// (e.g., because this handle is backed by an implicit team), we
	// store the TLF ID here so that we can look the TLF up from the
	// mdserver using the ID, instead of the handle.
	tlfID tlf.ID
}

// Type returns the type of the TLF this TlfHandle represents.
func (h TlfHandle) Type() tlf.Type {
	return h.tlfType
}

// IsBackedByTeam returns true if h represents a TLF backed by a team. It could
// be either a SingleTeam TLF or a private/public TLF backed by an implicit
// team.
func (h TlfHandle) IsBackedByTeam() bool {
	if len(h.resolvedWriters) != 1 ||
		len(h.resolvedReaders) != 0 ||
		len(h.unresolvedReaders) != 0 ||
		len(h.unresolvedWriters) != 0 {
		return false
	}
	return h.FirstResolvedWriter().IsTeamOrSubteam()
}

// TypeForKeying returns the keying type for the handle h.
func (h TlfHandle) TypeForKeying() tlf.KeyingType {
	if h.IsBackedByTeam() {
		return tlf.TeamKeying
	}
	return h.Type().ToKeyingType()
}

// TlfID returns the TLF ID corresponding to this handle, if it's
// known.  If it's wasn't known at the time the handle was
// constructed, tlf.NullID is returned.
func (h TlfHandle) TlfID() tlf.ID {
	return h.tlfID
}

// IsWriter returns whether or not the given user is a writer for the
// top-level folder represented by this TlfHandle.
func (h TlfHandle) IsWriter(user keybase1.UID) bool {
	// TODO(KBFS-2185) relax this?
	if h.TypeForKeying() == tlf.TeamKeying {
		panic("Can't check whether a user is a writer on a team TLF")
	}
	_, ok := h.resolvedWriters[user.AsUserOrTeam()]
	return ok
}

// IsReader returns whether or not the given user is a reader for the
// top-level folder represented by this TlfHandle.
func (h TlfHandle) IsReader(user keybase1.UID) bool {
	// TODO(KBFS-2185) relax this?
	if h.TypeForKeying() == tlf.TeamKeying {
		panic("Can't check whether a user is a reader on a team TLF")
	}
	if h.TypeForKeying() == tlf.PublicKeying || h.IsWriter(user) {
		return true
	}
	_, ok := h.resolvedReaders[user.AsUserOrTeam()]
	return ok
}

// ResolvedUsersMap returns a map of resolved users from uid to usernames.
func (h TlfHandle) ResolvedUsersMap() map[keybase1.UserOrTeamID]kbname.NormalizedUsername {
	m := make(map[keybase1.UserOrTeamID]kbname.NormalizedUsername,
		len(h.resolvedReaders)+len(h.resolvedWriters))
	for k, v := range h.resolvedReaders {
		m[k] = v
	}
	for k, v := range h.resolvedWriters {
		m[k] = v
	}
	return m
}

func (h TlfHandle) unsortedResolvedWriters() []keybase1.UserOrTeamID {
	if len(h.resolvedWriters) == 0 {
		return nil
	}
	writers := make([]keybase1.UserOrTeamID, 0, len(h.resolvedWriters))
	for r := range h.resolvedWriters {
		writers = append(writers, r)
	}
	return writers
}

// ResolvedWriters returns the handle's resolved writer IDs in sorted
// order.
func (h TlfHandle) ResolvedWriters() []keybase1.UserOrTeamID {
	writers := h.unsortedResolvedWriters()
	sort.Sort(tlf.UIDList(writers))
	return writers
}

// FirstResolvedWriter returns the handle's first resolved writer ID
// (when sorted).  For SingleTeam handles, this returns the team to
// which the TLF belongs.
func (h TlfHandle) FirstResolvedWriter() keybase1.UserOrTeamID {
	return h.ResolvedWriters()[0]
}

func (h TlfHandle) unsortedResolvedReaders() []keybase1.UserOrTeamID {
	if len(h.resolvedReaders) == 0 {
		return nil
	}
	readers := make([]keybase1.UserOrTeamID, 0, len(h.resolvedReaders))
	for r := range h.resolvedReaders {
		readers = append(readers, r)
	}
	return readers
}

// ResolvedReaders returns the handle's resolved reader IDs in sorted
// order. If the handle is public, nil will be returned.
func (h TlfHandle) ResolvedReaders() []keybase1.UserOrTeamID {
	readers := h.unsortedResolvedReaders()
	sort.Sort(tlf.UIDList(readers))
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
func (h TlfHandle) ConflictInfo() *tlf.HandleExtension {
	if h.conflictInfo == nil {
		return nil
	}
	conflictInfoCopy := *h.conflictInfo
	return &conflictInfoCopy
}

func (h TlfHandle) recomputeNameWithExtensions() tlf.CanonicalName {
	components := strings.Split(string(h.name), tlf.HandleExtensionSep)
	newName := components[0]
	extensionList := tlf.HandleExtensionList(h.Extensions())
	sort.Sort(extensionList)
	if h.IsBackedByTeam() {
		newName += extensionList.SuffixForTeamHandle()
	} else {
		newName += extensionList.Suffix()
	}
	return tlf.CanonicalName(newName)
}

// WithUpdatedConflictInfo returns a new handle with the conflict info set to
// the given one, if the existing one is nil. (In this case, the given one may
// also be nil.) Otherwise, the given conflict info must match the existing
// one.
func (h TlfHandle) WithUpdatedConflictInfo(
	codec kbfscodec.Codec, info *tlf.HandleExtension) (*TlfHandle, error) {
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
		return newHandle, tlf.HandleExtensionMismatchError{
			Expected: *newHandle.ConflictInfo(),
			Actual:   info,
		}
	}
	return newHandle, nil
}

// FinalizedInfo returns the handle's finalized info, if any.
func (h TlfHandle) FinalizedInfo() *tlf.HandleExtension {
	if h.finalizedInfo == nil {
		return nil
	}
	finalizedInfoCopy := *h.finalizedInfo
	return &finalizedInfoCopy
}

// SetFinalizedInfo sets the handle's finalized info to the given one,
// which may be nil.
// TODO: remove this to make TlfHandle fully immutable
func (h *TlfHandle) SetFinalizedInfo(info *tlf.HandleExtension) {
	if info == nil {
		h.finalizedInfo = nil
	} else {
		finalizedInfoCopy := *info
		h.finalizedInfo = &finalizedInfoCopy
	}
	h.name = h.recomputeNameWithExtensions()
}

// Extensions returns a list of extensions for the given handle.
func (h TlfHandle) Extensions() (extensions []tlf.HandleExtension) {
	if h.ConflictInfo() != nil {
		extensions = append(extensions, *h.ConflictInfo())
	}
	if h.FinalizedInfo() != nil {
		extensions = append(extensions, *h.FinalizedInfo())
	}
	return extensions
}

func init() {
	if reflect.ValueOf(TlfHandle{}).NumField() != 9 {
		panic(errors.New(
			"Unexpected number of fields in TlfHandle; " +
				"please update TlfHandle.Equals() for your " +
				"new or removed field"))
	}
}

// EqualsIgnoreName returns whether h and other contain the same info ignoring the name.
func (h TlfHandle) EqualsIgnoreName(
	codec kbfscodec.Codec, other TlfHandle) (bool, error) {
	if h.tlfType != other.tlfType {
		return false, nil
	}
	if h.tlfID != other.tlfID {
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
		return false, nil
	}

	return eq, nil
}

// ToBareHandle returns a tlf.Handle corresponding to this handle.
func (h TlfHandle) ToBareHandle() (tlf.Handle, error) {
	var readers []keybase1.UserOrTeamID
	switch h.TypeForKeying() {
	case tlf.PublicKeying:
		readers = []keybase1.UserOrTeamID{
			keybase1.UserOrTeamID(keybase1.PUBLIC_UID)}
	case tlf.TeamKeying:
		// Leave readers blank.
	default:
		readers = h.unsortedResolvedReaders()
	}
	return tlf.MakeHandle(
		h.unsortedResolvedWriters(), readers,
		h.unresolvedWriters, h.unresolvedReaders,
		h.Extensions())
}

// ToBareHandleOrBust returns a tlf.Handle corresponding to this
// handle, and panics if there's an error. Used by tests.
func (h TlfHandle) ToBareHandleOrBust() tlf.Handle {
	bh, err := h.ToBareHandle()
	if err != nil {
		panic(err)
	}
	return bh
}

func (h TlfHandle) deepCopy() *TlfHandle {
	hCopy := TlfHandle{
		tlfType:           h.tlfType,
		name:              h.name,
		unresolvedWriters: h.UnresolvedWriters(),
		unresolvedReaders: h.UnresolvedReaders(),
		conflictInfo:      h.ConflictInfo(),
		finalizedInfo:     h.FinalizedInfo(),
		tlfID:             h.tlfID,
	}

	hCopy.resolvedWriters = make(map[keybase1.UserOrTeamID]kbname.NormalizedUsername, len(h.resolvedWriters))
	for k, v := range h.resolvedWriters {
		hCopy.resolvedWriters[k] = v
	}

	hCopy.resolvedReaders = make(map[keybase1.UserOrTeamID]kbname.NormalizedUsername, len(h.resolvedReaders))
	for k, v := range h.resolvedReaders {
		hCopy.resolvedReaders[k] = v
	}

	return &hCopy
}

// GetCanonicalName returns the canonical name of this TLF.
func (h *TlfHandle) GetCanonicalName() tlf.CanonicalName {
	if h.name == "" {
		panic(fmt.Sprintf("TlfHandle %v with no name", h))
	}

	return h.name
}

// GetCanonicalPath returns the full canonical path of this TLF.
func (h *TlfHandle) GetCanonicalPath() string {
	return buildCanonicalPathForTlfName(h.Type(), h.GetCanonicalName())
}

// ToFavorite converts a TlfHandle into a Favorite, suitable for
// Favorites calls.
func (h *TlfHandle) ToFavorite() Favorite {
	return Favorite{
		Name: string(h.GetCanonicalName()),
		Type: h.Type(),
	}
}

// FavoriteData converts a TlfHandle into favoriteData, suitable for
// Favorites calls.
func (h *TlfHandle) FavoriteData() favoriteData {
	return favoriteData{
		Name:       string(h.GetCanonicalName()),
		FolderType: h.Type().FolderType(),
		// TODO: verify this conversion
		ID:      keybase1.TLFID(h.tlfID.String()),
		Private: h.Type() != tlf.Public,
		// TODO: find this team ID if we care about it
		TeamID:       keybase1.TeamID(0),
		ResetMembers: []keybase1.User{},
	}
}

// ToFavorite converts a TlfHandle into a Favorite, and sets internal
// state about whether the corresponding folder was just created or
// not.
func (h *TlfHandle) toFavToAdd(created bool) favToAdd {
	return favToAdd{
		Favorite: h.ToFavorite(),
		Data:     h.FavoriteData(),
		created:  created,
	}
}

func getSortedUnresolved(unresolved map[keybase1.SocialAssertion]bool) []keybase1.SocialAssertion {
	var assertions []keybase1.SocialAssertion
	for sa := range unresolved {
		assertions = append(assertions, sa)
	}
	sort.Sort(tlf.SocialAssertionList(assertions))
	return assertions
}

// splitAndNormalizeTLFName takes a tlf name as a string
// and tries to normalize it offline. In addition to other
// checks it returns TlfNameNotCanonical if it does not
// look canonical.
// Note that ordering differences do not result in TlfNameNotCanonical
// being returned.
func splitAndNormalizeTLFName(name string, t tlf.Type) (
	writerNames, readerNames []string,
	extensionSuffix string, err error) {
	writerNames, readerNames, extensionSuffix, err = tlf.SplitName(name)
	if err != nil {
		return nil, nil, "", err
	}
	if t == tlf.SingleTeam && len(writerNames) != 1 {
		// No team folder can have more than one writer.
		return nil, nil, "", NoSuchNameError{Name: name}
	}

	hasReaders := len(readerNames) != 0
	if t != tlf.Private && hasReaders {
		// No public/team folder can have readers.
		return nil, nil, "", NoSuchNameError{Name: name}
	}

	normalizedName, changes, err := normalizeNamesInTLF(
		writerNames, readerNames, t, extensionSuffix)
	if err != nil {
		return nil, nil, "", err
	}
	// Check for changes - not just ordering differences here.
	if changes {
		return nil, nil, "", errors.WithStack(TlfNameNotCanonical{name, normalizedName})
	}

	return writerNames, readerNames, strings.ToLower(extensionSuffix), nil
}

// TODO: this function can likely be replaced with a call to
// AssertionParseAndOnly when CORE-2967 and CORE-2968 are fixed.
func normalizeAssertionOrName(s string, t tlf.Type) (string, error) {
	if kbname.CheckUsername(s) {
		return kbname.NewNormalizedUsername(s).String(), nil
	}

	// TODO: this fails for http and https right now (see CORE-2968).
	socialAssertion, isSocialAssertion := externals.NormalizeSocialAssertionStatic(s)
	if isSocialAssertion {
		if t == tlf.SingleTeam {
			return "", fmt.Errorf(
				"No social assertions allowed for team TLF: %s", s)
		}
		return socialAssertion.String(), nil
	}

	sAssertion := s
	if t == tlf.SingleTeam {
		sAssertion = "team:" + s
	}
	if expr, err := externals.AssertionParseAndOnlyStatic(sAssertion); err == nil {
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

// normalizeNames normalizes a slice of names and returns
// whether any of them changed.
func normalizeNames(names []string, t tlf.Type) (changesMade bool, err error) {
	for i, name := range names {
		x, err := normalizeAssertionOrName(name, t)
		if err != nil {
			return false, err
		}
		if x != name {
			names[i] = x
			changesMade = true
		}
	}
	return changesMade, nil
}

// normalizeNamesInTLF takes a split TLF name and, without doing any
// resolutions or identify calls, normalizes all elements of the
// name. It then returns the normalized name and a boolean flag
// whether any names were modified.
// This modifies the slices passed as arguments.
func normalizeNamesInTLF(writerNames, readerNames []string,
	t tlf.Type, extensionSuffix string) (normalizedName string,
	changesMade bool, err error) {
	changesMade, err = normalizeNames(writerNames, t)
	if err != nil {
		return "", false, err
	}
	sort.Strings(writerNames)
	normalizedName = strings.Join(writerNames, ",")
	if len(readerNames) > 0 {
		rchanges, err := normalizeNames(readerNames, t)
		if err != nil {
			return "", false, err
		}
		changesMade = changesMade || rchanges
		sort.Strings(readerNames)
		normalizedName += tlf.ReaderSep + strings.Join(readerNames, ",")
	}
	if len(extensionSuffix) != 0 {
		// This *should* be normalized already but make sure.  I can see not
		// doing so might surprise a caller.
		nExt := strings.ToLower(extensionSuffix)
		normalizedName += tlf.HandleExtensionSep + nExt
		changesMade = changesMade || nExt != extensionSuffix
	}

	return normalizedName, changesMade, nil
}

// CheckTlfHandleOffline does light checks whether a TLF handle looks ok,
// it avoids all network calls.
func CheckTlfHandleOffline(
	ctx context.Context, name string, t tlf.Type) error {
	_, _, _, err := splitAndNormalizeTLFName(name, t)
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

// GetPreferredFormat returns a TLF name formatted with the username given
// as the parameter first.
// This calls tlf.CanonicalToPreferredName with the canonical
// tlf name which will be reordered into the preferred format.
// An empty username is allowed here and results in the canonical ordering.
func (h TlfHandle) GetPreferredFormat(
	username kbname.NormalizedUsername) tlf.PreferredName {
	s, err := tlf.CanonicalToPreferredName(username, h.GetCanonicalName())
	if err != nil {
		panic("TlfHandle.GetPreferredFormat: Parsing canonical username failed!")
	}
	return s
}
