#!/usr/bin/env bash

set -e -u -o pipefail # Fail on error

here=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )

clientdir="$(git -C "$here" rev-parse --show-toplevel)"
src_dir="$clientdir/../kbfs"
dest_dir="$clientdir/../kbfs-beta"

name=kbfs
kbfs_dirs=(kbfs kbfsfuse libfs libfuse libkbfs metricsutil vendor)

"$clientdir/packaging/check_status_and_pull.sh" "$src_dir"
"$clientdir/packaging/check_status_and_pull.sh" "$dest_dir"

if [ ! -d "$src_dir" ]; then
  echo "$src_dir doesn't exist"
  exit 2
fi

if [ ! -d "$dest_dir" ]; then
  echo "$dest_dir doesn't exist"
  exit 2
fi

echo "Source: $src_dir"
echo "Dirs to export: $kbfs_dirs"
echo "Destination: $dest_dir"
echo " "

# Archive the repo
cd $src_dir
echo "Building git archive"
git archive --format tar HEAD > $src_dir/$name.tar

# Copy archive to dest and unpack
echo "Unpacking archive in $dest_dir"
cd $dest_dir
rm -rf $name
mkdir -p $name
tar xpf $src_dir/kbfs.tar -C kbfs ${kbfs_dirs[@]}

rm $src_dir/$name.tar

cd $dest_dir
echo "Committing"
git add .
if git commit -m "Updating repo" ; then
  git push
else
  echo "Nothing to commit in kbfs-beta, skipping push."
fi
