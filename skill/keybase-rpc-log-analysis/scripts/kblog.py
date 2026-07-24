"""Shared parsing for keybase service logs.

Line shape:
  2026-07-24T17:19:03.576384-04:00 ▶ [DEBU keybase utils.go:537] 286366 ++Chat: | Body [tags:k=v,...]
"""

import re

TS_LEN = 19  # 2026-07-24T17:19:03
BODY_RE = re.compile(r"\]\s+\w+\s+(.*)")
TAGS_RE = re.compile(r"\[tags:.*")
TIME_RE = re.compile(r"\[time=[^\]]*\]")
HEXID_RE = re.compile(r"[0-9a-f]{16,}")
# an id explicitly labelled as a conversation
CONVID_RE = re.compile(r"conv(?:ID)?[:= (]+([0-9a-f]{16,})", re.I)
# the logged-in user's id, which appears on a great many lines. It has to be
# excluded when guessing what a call was about, or every call looks like it
# shares a subject.
UID_RE = re.compile(r"uid:\s*([0-9a-f]{16,})")


def subject_of(line, uid=None):
    """Best guess at what a line is about: a labelled conv id, else the first id
    that is not the logged-in user."""
    stripped = TAGS_RE.sub("", line)
    m = CONVID_RE.search(stripped)
    if m:
        return m.group(1)
    for candidate in HEXID_RE.findall(stripped):
        if candidate != uid:
            return candidate
    return None
NUM_RE = re.compile(r"\b\d+\b")
TRACE_RE = re.compile(r"chat-trace=(\w+)")

# app -> service: a local RPC the client asked for
SERVER_RE = re.compile(r"\+ Server: (\w+)(\([^)]*\))?")
# service -> keybase servers: these are what burn the server-side rate limits
REMOTE_RE = re.compile(r"\+ RemoteClient: ([\w.]+)")
# raw HTTP to the API host
HTTP_RE = re.compile(r"(GET|POST) (https?://[^\s?]+)")


def body(line):
    m = BODY_RE.search(line)
    return (m.group(1) if m else line).rstrip()


def normalize(line, width=95):
    """Collapse ids, numbers and trailing metadata so repeated lines group."""
    s = body(line)
    s = TAGS_RE.sub("", s)
    s = TIME_RE.sub("", s)
    s = HEXID_RE.sub("<id>", s)
    s = NUM_RE.sub("<n>", s)
    return s.strip()[:width]


def stamp(line, precision=19):
    """precision: 19=second, 16=minute, 13=hour."""
    return line[:precision] if len(line) >= precision else None


def iter_lines(paths, start=None, end=None):
    """Yield lines from each path, optionally filtered to a timestamp window.

    start/end are prefixes, e.g. '2026-07-24T17:23'.
    """
    for path in paths:
        with open(path, errors="ignore") as f:
            for line in f:
                if start or end:
                    ts = line[:TS_LEN]
                    if not ts.startswith("2"):
                        continue
                    if start and ts < start:
                        continue
                    if end and ts > end:
                        continue
                yield line


def trace(line):
    m = TRACE_RE.search(line)
    return m.group(1) if m else None
