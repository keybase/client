# These tests all do one conflict-free operation while a user is unstaged.
module Test
  # bob writes a non-conflicting file while unstaged
  test :cr_unmerged_file, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkfile "a/b", "hello"
    end
    as bob do
      disable_updates
    end
    as alice do
      write "a/c", "world"
    end
    as bob, sync: false do
      write "a/d", "uh oh"
      reenable_updates
      lsdir "a/", { "b" => "FILE", "c" => "FILE", "d" => "FILE" }
      read "a/b", "hello"
      read "a/c", "world"
      read "a/d", "uh oh"
    end
    as alice do
      lsdir "a/", { "b" => "FILE", "c" => "FILE", "d" => "FILE" }
      read "a/b", "hello"
      read "a/c", "world"
      read "a/d", "uh oh"
    end
  end

  # bob writes a non-conflicting dir (containing a file) while unstaged
  test :cr_unmerged_dir, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkfile "a/b", "hello"
    end
    as bob do
      disable_updates
    end
    as alice do
      write "a/c", "world"
    end
    as bob, sync: false do
      write "a/d/e", "uh oh"
      reenable_updates
      lsdir "a/", { "b" => "FILE", "c" => "FILE", "d" => "DIR" }
      read "a/b", "hello"
      read "a/c", "world"
      lsdir "a/d", { "e" => "FILE" }
      read "a/d/e", "uh oh"
    end
    as alice do
      lsdir "a/", { "b" => "FILE", "c" => "FILE", "d" => "DIR" }
      read "a/b", "hello"
      read "a/c", "world"
      lsdir "a/d", { "e" => "FILE" }
      read "a/d/e", "uh oh"
    end
  end

  # bob creates a non-conflicting symlink while unstaged
  test :cr_unmerged_symlink, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkfile "a/b", "hello"
    end
    as bob do
      disable_updates
    end
    as alice do
      write "a/c", "world"
    end
    as bob, sync: false do
      link "a/d", "b"
      reenable_updates
      lsdir "a/", { "b" => "FILE", "c" => "FILE", "d" => "SYM" }
      read "a/b", "hello"
      read "a/c", "world"
      read "a/d", "hello"
    end
    as alice do
      lsdir "a/", { "b" => "FILE", "c" => "FILE", "d" => "SYM" }
      read "a/b", "hello"
      read "a/c", "world"
      read "a/d", "hello"
    end
  end

  # bob makes a non-conflicting file executable while unstaged
  test :cr_unmerged_setex, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkfile "a/b", "hello"
    end
    as bob do
      disable_updates
    end
    as alice do
      write "a/c", "world"
    end
    as bob, sync: false do
      setex "a/b", true
      reenable_updates
      lsdir "a/", { "b" => "EXEC", "c" => "FILE"}
      read "a/c", "world"
    end
    as alice do
      lsdir "a/", { "b" => "EXEC", "c" => "FILE"}
      read "a/c", "world"
    end
  end

  # bob deletes a non-conflicting file while unstaged
  test :cr_unmerged_rmfile, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkfile "a/b", "hello"
    end
    as bob do
      disable_updates
    end
    as alice do
      write "a/c", "world"
    end
    as bob, sync: false do
      rm "a/b"
      reenable_updates
      lsdir "a/", { "c" => "FILE"}
      read "a/c", "world"
    end
    as alice do
      lsdir "a/", { "c" => "FILE"}
      read "a/c", "world"
    end
  end

  # bob deletes a non-conflicting dir while unstaged
  test :cr_unmerged_rmdir, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkdir "a/b"
    end
    as bob do
      disable_updates
    end
    as alice do
      write "a/c", "world"
    end
    as bob, sync: false do
      rmdir "a/b"
      reenable_updates
      lsdir "a/", { "c" => "FILE"}
      read "a/c", "world"
    end
    as alice do
      lsdir "a/", { "c" => "FILE"}
      read "a/c", "world"
    end
  end

  # bob renames a non-conflicting file while unstaged
  test :cr_unmerged_rename_in_dir, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkfile "a/b", "hello"
    end
    as bob do
      disable_updates
    end
    as alice do
      write "a/c", "world"
    end
    as bob, sync: false do
      rename "a/b", "a/d"
      reenable_updates
      lsdir "a/", { "c" => "FILE", "d" => "FILE"}
      read "a/c", "world"
      read "a/d", "hello"
    end
    as alice do
      lsdir "a/", { "c" => "FILE", "d" => "FILE"}
      read "a/c", "world"
      read "a/d", "hello"
    end
  end

  # bob renames a non-conflicting symlink while unstaged
  test :cr_unmerged_rename_symlink_in_dir, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkfile "a/b", "hello"
      link "a/c", "b"
    end
    as bob do
      disable_updates
    end
    as alice do
      write "a/d", "world"
    end
    as bob, sync: false do
      rename "a/c", "a/e"
      reenable_updates
      lsdir "a/", { "b" => "FILE", "d" => "FILE", "e" => "SYM"}
      read "a/d", "world"
      read "a/e", "hello"
    end
    as alice do
      lsdir "a/", { "b" => "FILE", "d" => "FILE", "e" => "SYM"}
      read "a/d", "world"
      read "a/e", "hello"
    end
  end

  # bob renames a non-conflicting file in the root dir while unstaged
  # TODO: unskip when KBFS-473 is fixed.
  test :cr_unmerged_rename_in_root, skip: true, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkfile "b", "hello"
    end
    as bob do
      disable_updates
    end
    as alice do
      write "a/c", "world"
    end
    as bob, sync: false do
      rename "b", "d"
      reenable_updates
      lsdir "", { "d" => "FILE"}
      lsdir "a/", { "c" => "FILE"}
      read "a/c", "world"
      read "d", "hello"
    end
    as alice do
      lsdir "", { "d" => "FILE"}
      lsdir "a/", { "c" => "FILE"}
      read "a/c", "world"
      read "d", "hello"
    end
  end

  # bob renames a non-conflicting file across directories while unstaged
  test :cr_unmerged_rename_across_dirs, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkfile "a/b", "hello"
      mkdir "d"
    end
    as bob do
      disable_updates
    end
    as alice do
      write "a/c", "world"
    end
    as bob, sync: false do
      rename "a/b", "d/e"
      reenable_updates
      lsdir "a/", { "c" => "FILE" }
      lsdir "d/", { "e" => "FILE" }
      read "a/c", "world"
      read "d/e", "hello"
    end
    as alice do
      lsdir "a/", { "c" => "FILE" }
      lsdir "d/", { "e" => "FILE" }
      read "a/c", "world"
      read "d/e", "hello"
    end
  end

  # bob renames a file over an existing file
  test :cr_unmerged_rename_file_over_file, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkfile "a/b", "hello"
      mkfile "a/c", "world"
    end
    as bob do
      disable_updates
    end
    as alice do
      write "a/d", "just another file"
    end
    as bob, sync: false do
      rename "a/c", "a/b"
      reenable_updates
      lsdir "a/", { "b" => "FILE", "d" => "FILE" }
      read "a/b", "world"
      read "a/d", "just another file"
    end
    as alice do
      lsdir "a/", { "b" => "FILE", "d" => "FILE" }
      read "a/b", "world"
      read "a/d", "just another file"
    end
  end

  # bob renames a directory over an existing file
  test :cr_unmerged_rename_dir_over_file, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkfile "a/b", "hello"
      mkfile "a/c/d", "world"
    end
    as bob do
      disable_updates
    end
    as alice do
      write "a/e", "just another file"
    end
    as bob, sync: false do
      rename "a/c", "a/b"
      reenable_updates
      lsdir "a/", { "b" => "DIR", "e" => "FILE" }
      read "a/b/d", "world"
      read "a/e", "just another file"
    end
    as alice do
      lsdir "a/", { "b" => "DIR", "e" => "FILE" }
      read "a/b/d", "world"
      read "a/e", "just another file"
    end
  end

  # alice makes a non-conflicting dir (containing a file) while bob is
  # unstaged
  test :cr_merged_dir, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkfile "a/b", "hello"
    end
    as bob do
      disable_updates
    end
    as alice do
      write "a/d/e", "uh oh"
    end
    as bob, sync: false do
      write "a/c", "world"
      reenable_updates
      lsdir "a/", { "b" => "FILE", "c" => "FILE", "d" => "DIR" }
      read "a/b", "hello"
      read "a/c", "world"
      lsdir "a/d", { "e" => "FILE" }
      read "a/d/e", "uh oh"
    end
    as alice do
      lsdir "a/", { "b" => "FILE", "c" => "FILE", "d" => "DIR" }
      read "a/b", "hello"
      read "a/c", "world"
      lsdir "a/d", { "e" => "FILE" }
      read "a/d/e", "uh oh"
    end
  end

  # alice creates a non-conflicting symlink while bob is unstaged
  test :cr_merged_symlink, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkfile "a/b", "hello"
    end
    as bob do
      disable_updates
    end
    as alice do
      link "a/d", "b"
    end
    as bob, sync: false do
      write "a/c", "world"
      reenable_updates
      lsdir "a/", { "b" => "FILE", "c" => "FILE", "d" => "SYM" }
      read "a/b", "hello"
      read "a/c", "world"
      read "a/d", "hello"
    end
    as alice do
      lsdir "a/", { "b" => "FILE", "c" => "FILE", "d" => "SYM" }
      read "a/b", "hello"
      read "a/c", "world"
      read "a/d", "hello"
    end
  end

  # alice makes a non-conflicting file executable while bob is unstaged
  test :cr_merged_setex, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkfile "a/b", "hello"
    end
    as bob do
      disable_updates
    end
    as alice do
      setex "a/b", true
    end
    as bob, sync: false do
      write "a/c", "world"
      reenable_updates
      lsdir "a/", { "b" => "EXEC", "c" => "FILE"}
      read "a/c", "world"
    end
    as alice do
      lsdir "a/", { "b" => "EXEC", "c" => "FILE"}
      read "a/c", "world"
    end
  end

  # alice deletes a non-conflicting file while bob is unstaged
  test :cr_merged_rmfile, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkfile "a/b", "hello"
    end
    as bob do
      disable_updates
    end
    as alice do
      rm "a/b"
    end
    as bob, sync: false do
      write "a/c", "world"
      reenable_updates
      lsdir "a/", { "c" => "FILE"}
      read "a/c", "world"
    end
    as alice do
      lsdir "a/", { "c" => "FILE"}
      read "a/c", "world"
    end
  end

  # alice deletes a non-conflicting dir while bob is unstaged
  test :cr_merged_rmdir, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkdir "a/b"
    end
    as bob do
      disable_updates
    end
    as alice do
      rmdir "a/b"
    end
    as bob, sync: false do
      write "a/c", "world"
      reenable_updates
      lsdir "a/", { "c" => "FILE"}
      read "a/c", "world"
    end
    as alice do
      lsdir "a/", { "c" => "FILE"}
      read "a/c", "world"
    end
  end

  # alice renames a non-conflicting file while bob is unstaged
  test :cr_merged_rename_in_dir, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkfile "a/b", "hello"
    end
    as bob do
      disable_updates
    end
    as alice do
      rename "a/b", "a/d"
    end
    as bob, sync: false do
      write "a/c", "world"
      reenable_updates
      lsdir "a/", { "c" => "FILE", "d" => "FILE"}
      read "a/c", "world"
      read "a/d", "hello"
    end
    as alice do
      lsdir "a/", { "c" => "FILE", "d" => "FILE"}
      read "a/c", "world"
      read "a/d", "hello"
    end
  end

  # alice renames a non-conflicting file in the root dir while bob is unstaged
  # TODO: unskip when KBFS-473 is fixed.
  test :cr_merged_rename_in_root, skip: true, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkfile "b", "hello"
    end
    as bob do
      disable_updates
    end
    as alice do
      rename "b", "d"
    end
    as bob, sync: false do
      write "a/c", "world"
      reenable_updates
      lsdir "", { "d" => "FILE"}
      lsdir "a/", { "c" => "FILE"}
      read "a/c", "world"
      read "d", "hello"
    end
    as alice do
      lsdir "", { "d" => "FILE"}
      lsdir "a/", { "c" => "FILE"}
      read "a/c", "world"
      read "d", "hello"
    end
  end

  # alice renames a non-conflicting file across directories while bob
  # is unstaged
  test :cr_merged_rename_across_dirs, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkfile "a/b", "hello"
      mkdir "d"
    end
    as bob do
      disable_updates
    end
    as alice do
      rename "a/b", "d/e"
    end
    as bob, sync: false do
      write "a/c", "world"
      reenable_updates
      lsdir "a/", { "c" => "FILE" }
      lsdir "d/", { "e" => "FILE" }
      read "a/c", "world"
      read "d/e", "hello"
    end
    as alice do
      lsdir "a/", { "c" => "FILE" }
      lsdir "d/", { "e" => "FILE" }
      read "a/c", "world"
      read "d/e", "hello"
    end
  end

  # alice and bob write the same dir (containing a file) while bob's unstaged
  test :cr_merge_dir, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkdir "a"
    end
    as bob do
      disable_updates
    end
    as alice do
      write "a/b/c", "hello"
    end
    as bob, sync: false do
      write "a/b/d", "world"
      reenable_updates
      lsdir "a/", { "b" => "DIR" }
      lsdir "a/b", { "c" => "FILE", "d" => "FILE" }
      read "a/b/c", "hello"
      read "a/b/d", "world"
    end
    as alice do
      lsdir "a/", { "b" => "DIR" }
      lsdir "a/b", { "c" => "FILE", "d" => "FILE" }
      read "a/b/c", "hello"
      read "a/b/d", "world"
    end
  end

  # alice and bob both delete the same file
  test :cr_unmerged_both_rmfile, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkfile "a/b", "hello"
    end
    as bob do
      disable_updates
    end
    as alice do
      write "a/c", "world"
      rm "a/b"
    end
    as bob, sync: false do
      rm "a/b"
      reenable_updates
      lsdir "a/", { "c" => "FILE" }
    end
    as alice do
      lsdir "a/", { "c" => "FILE" }
    end
  end
end
