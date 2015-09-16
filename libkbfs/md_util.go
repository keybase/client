package libkbfs

import (
	"errors"
	"fmt"

	"golang.org/x/net/context"
)

type mdRange struct {
	start MetadataRevision
	end   MetadataRevision
}

func getMDRange(ctx context.Context, config Config, id TlfID,
	start MetadataRevision, end MetadataRevision, mStatus MergeStatus) (
	rmds []*RootMetadata, err error) {
	// The range is invalid.  Don't treat as an error though; it just
	// indicates that we don't yet know about any revisions.
	if start < MetadataRevisionInitial || end < MetadataRevisionInitial {
		return nil, nil
	}

	mdcache := config.MDCache()
	var toDownload []mdRange

	// Fetch one at a time, and figure out what ranges to fetch as you
	// go.
	minSlot := int(end-start) + 1
	maxSlot := -1
	for i := start; i <= end; i++ {
		rmd, err := mdcache.Get(id, i, mStatus)
		if err != nil {
			if len(toDownload) == 0 ||
				toDownload[len(toDownload)-1].end != i-1 {
				toDownload = append(toDownload, mdRange{i, i})
			}
			toDownload[len(toDownload)-1].end = i
			rmd = nil
		} else {
			slot := len(rmds)
			if slot < minSlot {
				minSlot = slot
			}
			if slot > maxSlot {
				maxSlot = slot
			}
		}
		rmds = append(rmds, rmd)
	}

	// Try to fetch the rest from the server.  TODO: parallelize me.
	for _, r := range toDownload {
		var fetchedRmds []*RootMetadata
		switch mStatus {
		case Merged:
			fetchedRmds, err = config.MDOps().GetRange(
				ctx, id, r.start, r.end)
		case Unmerged:
			fetchedRmds, err = config.MDOps().GetUnmergedRange(
				ctx, id, r.start, r.end)
		default:
			panic(fmt.Sprintf("Unknown merged type: %s", mStatus))
		}
		if err != nil {
			return nil, err
		}

		for _, rmd := range fetchedRmds {
			slot := int(rmd.Revision - start)
			if slot < minSlot {
				minSlot = slot
			}
			if slot > maxSlot {
				maxSlot = slot
			}

			rmds[slot] = rmd
		}
	}

	if minSlot > maxSlot {
		return nil, nil
	}

	rmds = rmds[minSlot : maxSlot+1]
	// check to make sure there are no holes
	for i, rmd := range rmds {
		if rmd == nil {
			return nil, fmt.Errorf("No %s MD found for revision %d",
				mStatus, int(start)+minSlot+i)
		}
	}

	return rmds, nil
}

func getMergedMDUpdates(ctx context.Context, config Config, id TlfID,
	startRev MetadataRevision) (mergedRmds []*RootMetadata, err error) {
	// We don't yet know about any revisions yet, so there's no range
	// to get.
	if startRev < MetadataRevisionInitial {
		return nil, nil
	}

	start := startRev
	for {
		end := start + maxMDsAtATime - 1 // range is inclusive
		rmds, err := getMDRange(ctx, config, id, start, end, Merged)
		if err != nil {
			return nil, err
		}

		mergedRmds = append(mergedRmds, rmds...)

		// TODO: limit the number of MDs we're allowed to hold in
		// memory at any one time?
		if len(rmds) < maxMDsAtATime {
			return mergedRmds, nil
		}
		start = end + 1
	}
}

func getUnmergedMDUpdates(ctx context.Context, config Config, id TlfID,
	startRev MetadataRevision) (
	currHead MetadataRevision, unmergedRmds []*RootMetadata, err error) {
	// We don't yet know about any revisions yet, so there's no range
	// to get.
	if startRev < MetadataRevisionInitial {
		return MetadataRevisionUninitialized, nil, nil
	}

	// walk backwards until we find one that is merged
	currHead = startRev
	for {
		// first look up all unmerged MD revisions older than my current head
		startRev := currHead - maxMDsAtATime + 1 // (MetadataRevision is signed)
		if startRev < MetadataRevisionInitial {
			startRev = MetadataRevisionInitial
		}

		rmds, err := getMDRange(ctx, config, id, startRev, currHead, Unmerged)
		if err != nil {
			return MetadataRevisionUninitialized, nil, err
		}

		numNew := len(rmds)
		// prepend to keep the ordering correct
		unmergedRmds = append(rmds, unmergedRmds...)

		// on the next iteration, start apply the previous root
		if numNew > 0 {
			currHead = rmds[0].Revision - 1
		}
		if currHead < MetadataRevisionInitial {
			return MetadataRevisionUninitialized, nil,
				errors.New("Ran out of MD updates to unstage!")
		}
		// TODO: limit the number of MDs we're allowed to hold in
		// memory at any one time?
		if numNew < maxMDsAtATime {
			break
		}
	}
	return currHead, unmergedRmds, nil
}
