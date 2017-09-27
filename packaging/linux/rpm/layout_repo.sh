#! /usr/bin/env bash

# Invokes the build_rpm.sh script in the Go client repo, copies the resulting
# package here, and then updates the RPM repo hierarchy. Does not check for
# cleanliness or make a commit or anything; that's the caller's responsibility.
#
# Dependencies:
#   - regular Go setup for building the client
#   - rpmbuild for building the .rpm
#   - createrepo (or createrepo_c) for writing the hierarchy

set -e -u -o pipefail

here="$(dirname "$BASH_SOURCE")"

build_root="${1:-}"
if [ -z "$build_root" ] ; then
  echo 'Usage:  ./layout_repo.sh <build_root>'
  exit 1
fi

mode="$(cat "$build_root/MODE")"

binary_name="$("$here/../../binary_name.sh" "$mode")"

repo_root="$build_root/rpm_repo"

# Run the RPM packaging script on this build root.
"$here/package_binaries.sh" "$build_root"

code_signing_fingerprint="$(cat "$here/../code_signing_fingerprint")"

# Get the name of the create repo program. It can be called either "createrepo"
# (normally) or "createrepo_c" (on Arch).
if which createrepo &> /dev/null ; then
  CREATEREPO=createrepo
elif which createrepo_c &> /dev/null ; then
  CREATEREPO=createrepo_c
else
  echo "ERROR: createrepo doesn't seem to be installed."
  exit 1
fi

# Copy the RPM files into our repo. This is flatter than the way Debian's
# reprepro does things, and it's allowed to contain multiple copies of the same
# package.
for arch in i386 x86_64 ; do
  rpmfile="$(ls "$build_root/rpm/$arch/RPMS/$arch"/*.rpm)"  # keybase, kdstage, or kbdev
  rpmname="$(basename "$rpmfile")"
  destdir="$repo_root/repo/$arch"
  mkdir -p "$destdir"
  rpmcopy="$destdir/$rpmname"
  cp "$rpmfile" "$rpmcopy"

  # Sign the RPM package. Note that while Debian signs the tree of all package
  # hashes in a text file at the root of the Debian repo, RPM puts a separate
  # signature in each package file. Command copied from:
  # https://ask.fedoraproject.org/en/question/56107/can-gpg-agent-be-used-when-signing-rpm-packages/
  #
  # The `setsid` and `/dev/null` bits are both required to suppress the no-op
  # password prompt that appears despite the agent configs.
  echo "Signing '$rpmcopy'..."
  setsid -w rpm \
   --define "_gpg_name $code_signing_fingerprint"  \
   --define '_signature gpg' \
   --define '__gpg_check_password_cmd /bin/true' \
   --define '__gpg_sign_cmd %{__gpg} gpg --batch --no-verbose --no-armor --use-agent --no-secmem-warning -u "%{_gpg_name}" -sbo %{__signature_filename} %{__plaintext_filename}' \
   --addsign "$rpmcopy" < /dev/null

  # Add a standalone signature file, for user convenience. Other packaging
  # steps will pick this up and copy it around.
  code_signing_fingerprint="$(cat "$here/../code_signing_fingerprint")"
  gpg --detach-sign --armor --use-agent --default-key "$code_signing_fingerprint" \
      -o "$rpmcopy.sig" "$rpmcopy"

  # Update the latest pointer. Even though the RPM repo is split by
  # architecture, put these links at the root of it with the arch in the
  # filename, for consistency with what we're doing in Debian.
  ln -sf "repo/$arch/$rpmname" "$repo_root/$binary_name-latest-$arch.rpm"
  ln -sf "repo/$arch/$rpmname.sig" "$repo_root/$binary_name-latest-$arch.rpm.sig"

  # Run createrepo to update the database files.
  "$CREATEREPO" "$repo_root/repo/$arch"
done
