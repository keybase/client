"""Shared helpers for parsing React DevTools Profiler exports (version 4/5 JSON)."""

import json


def load(path):
    data = json.load(open(path))
    return data


def root_info(root):
    """Build fiber id -> displayName and id -> parent id maps from the root's snapshot.

    The snapshot describes the tree at the END of profiling. Fibers rendered during
    profiling but unmounted before it stopped are absent — they show up as '#<id>'.
    """
    names = {}
    parents = {}
    for fid, info in root.get("snapshots") or []:
        names[int(fid)] = info.get("displayName") or "?"
        for ch in info.get("children", []):
            parents[int(ch)] = int(fid)
    return names, parents


def fiber_path(fid, names, parents, depth=6):
    out = []
    while fid is not None and depth > 0:
        out.append(names.get(fid, f"#{fid}"))
        fid = parents.get(fid)
        depth -= 1
    return " < ".join(out)


def updater_names(commit):
    return [f"{u.get('displayName') or '?'}#{u.get('id')}" for u in commit.get("updaters") or []]
