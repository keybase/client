# These tests all do multiple operations while a user is unstaged.
module Test
  # bob and alice both write to the same file
  test :cr_conflict_write_file, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkfile "a/b", "hello"
    end
    as bob do
      disable_updates
    end
    as alice do
      write "a/b", "world"
    end
    as bob, sync: false do
      write "a/b", "uh oh"
      reenable_updates
      lsdir "a/", { "b$" => "FILE", "b.conflict.bob.0001-01-01T00:00:00Z" => "FILE" }
      read "a/b", "world"
      read "a/b.conflict.bob.0001-01-01T00:00:00Z", "uh oh"
    end
    as alice do
      lsdir "a/", { "b$" => "FILE", "b.conflict.bob.0001-01-01T00:00:00Z" => "FILE" }
      read "a/b", "world"
      read "a/b.conflict.bob.0001-01-01T00:00:00Z", "uh oh"
    end
  end

  # bob and alice both create the same file
  test :cr_conflict_create_file, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkdir "a"
    end
    as bob do
      disable_updates
    end
    as alice do
      write "a/b", "world"
    end
    as bob, sync: false do
      write "a/b", "uh oh"
      reenable_updates
      lsdir "a/", { "b$" => "FILE", "b.conflict.bob.0001-01-01T00:00:00Z" => "FILE" }
      read "a/b", "world"
      read "a/b.conflict.bob.0001-01-01T00:00:00Z", "uh oh"
    end
    as alice do
      lsdir "a/", { "b$" => "FILE", "b.conflict.bob.0001-01-01T00:00:00Z" => "FILE" }
      read "a/b", "world"
      read "a/b.conflict.bob.0001-01-01T00:00:00Z", "uh oh"
    end
  end

  # bob creates a directory with the same name that alice used for a file
  test :cr_conflict_cause_rename_of_merged_file, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkdir "a"
    end
    as bob do
      disable_updates
    end
    as alice do
      write "a/b", "world"
    end
    as bob, sync: false do
      write "a/b/c", "uh oh"
      reenable_updates
      lsdir "a/", { "b$" => "DIR", "b.conflict.alice.0001-01-01T00:00:00Z" => "FILE" }
      read "a/b.conflict.alice.0001-01-01T00:00:00Z", "world"
      read "a/b/c", "uh oh"
    end
    as alice do
      lsdir "a/", { "b$" => "DIR", "b.conflict.alice.0001-01-01T00:00:00Z" => "FILE" }
      read "a/b.conflict.alice.0001-01-01T00:00:00Z", "world"
      read "a/b/c", "uh oh"
    end
  end

  # bob renames an existing directory over one created by alice.
  # TODO: it would be better if this weren't a conflict.
  test :cr_conflict_unmerged_renamed_dir, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      write "a/b/c", "hello"
    end
    as bob do
      disable_updates
    end
    as alice do
      write "a/d/e", "world"
    end
    as bob, sync: false do
      write "a/b/f", "uh oh"
      rename "a/b", "a/d"
      reenable_updates
      lsdir "a/", { "d$" => "DIR", "d.conflict.bob.0001-01-01T00:00:00Z" => "DIR"  }
      lsdir "a/d", { "e" => "FILE" }
      lsdir "a/d.conflict.bob.0001-01-01T00:00:00Z", { "c" => "FILE", "f" => "FILE" }
      read "a/d.conflict.bob.0001-01-01T00:00:00Z/c", "hello"
      read "a/d/e", "world"
      read "a/d.conflict.bob.0001-01-01T00:00:00Z/f", "uh oh"
    end
    as alice do
      lsdir "a/", { "d$" => "DIR", "d.conflict.bob.0001-01-01T00:00:00Z" => "DIR"  }
      lsdir "a/d", { "e" => "FILE" }
      lsdir "a/d.conflict.bob.0001-01-01T00:00:00Z", { "c" => "FILE", "f" => "FILE" }
      read "a/d.conflict.bob.0001-01-01T00:00:00Z/c", "hello"
      read "a/d/e", "world"
      read "a/d.conflict.bob.0001-01-01T00:00:00Z/f", "uh oh"
    end
  end

  # alice renames an existing directory over one created by bob. TODO:
  # it would be better if this weren't a conflict.
  test :cr_conflict_merged_renamed_dir, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      write "a/b/c", "hello"
    end
    as bob do
      disable_updates
    end
    as alice do
      write "a/b/f", "uh oh"
      rename "a/b", "a/d"
    end
    as bob, sync: false do
      write "a/d/e", "world"
      reenable_updates
      lsdir "a/", { "d$" => "DIR", "d.conflict.bob.0001-01-01T00:00:00Z" => "DIR"  }
      lsdir "a/d", { "c" => "FILE", "f" => "FILE" }
      read "a/d/c", "hello"
      read "a/d.conflict.bob.0001-01-01T00:00:00Z/e", "world"
      read "a/d/f", "uh oh"
    end
    as alice do
      lsdir "a/", { "d$" => "DIR", "d.conflict.bob.0001-01-01T00:00:00Z" => "DIR"  }
      lsdir "a/d", { "c" => "FILE", "f" => "FILE" }
      read "a/d/c", "hello"
      read "a/d.conflict.bob.0001-01-01T00:00:00Z/e", "world"
      read "a/d/f", "uh oh"
    end
  end

  test :cr_conflict_rename_same_file, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      write "a/b", "hello"
    end
    as bob do
      disable_updates
    end
    as alice do
      rename "a/b", "a/c"
    end
    as bob, sync: false do
      rename "a/b", "a/d"
      reenable_updates error: "Conflict resolution didn't take us out of staging."
      # TODO: when this works, uncomment the following:
      # lsdir "a/", { "c" => "FILE", "d" => "SYM" }
      # read "a/c", "hello"
      # read "a/d", "hello"
      lsdir "a/", { "d" => "FILE" }
    end
    as alice do
      # lsdir "a/", { "c" => "FILE", "d" => "SYM" }
      # read "a/c", "hello"
      # read "a/d", "hello"
      lsdir "a/", { "c" => "FILE" }
    end
  end

  test :cr_conflict_rename_same_dir, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      write "a/b/c", "hello"
    end
    as bob do
      disable_updates
    end
    as alice do
      rename "a/b", "a/d"
    end
    as bob, sync: false do
      rename "a/b", "a/e"
      reenable_updates error: "Conflict resolution didn't take us out of staging."
      # TODO: when this works, uncomment the following:
      # lsdir "a/", { "d" => "DIR", "e" => "SYM" }
      # read "a/d/c", "hello"
      # read "a/e/c", "hello"
      lsdir "a/", { "e" => "DIR" }
    end
    as alice do
      # lsdir "a/", { "d" => "DIR", "e" => "SYM" }
      # read "a/d/c", "hello"
      # read "a/e/c", "hello"
      lsdir "a/", { "d" => "DIR" }
    end
  end

  # bob renames an existing directory over one created by alice, twice.
  # TODO: it would be better if this weren't a conflict.
  test :cr_conflict_unmerged_renamed_dir_double, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      write "a/b/c", "hello"
    end
    as bob do
      disable_updates
    end
    as alice do
      write "a/d/e", "world"
    end
    as bob, sync: false do
      write "a/b/f", "uh oh"
      rename "a/b", "a/d"
      reenable_updates
      lsdir "a/", { "d$" => "DIR", "d.conflict.bob.0001-01-01T00:00:00Z" => "DIR"  }
      lsdir "a/d", { "e" => "FILE" }
      lsdir "a/d.conflict.bob.0001-01-01T00:00:00Z", { "c" => "FILE", "f" => "FILE" }
      read "a/d.conflict.bob.0001-01-01T00:00:00Z/c", "hello"
      read "a/d/e", "world"
      read "a/d.conflict.bob.0001-01-01T00:00:00Z/f", "uh oh"
    end
    as alice do
      lsdir "a/", { "d$" => "DIR", "d.conflict.bob.0001-01-01T00:00:00Z" => "DIR"  }
      lsdir "a/d", { "e" => "FILE" }
      lsdir "a/d.conflict.bob.0001-01-01T00:00:00Z", { "c" => "FILE", "f" => "FILE" }
      read "a/d.conflict.bob.0001-01-01T00:00:00Z/c", "hello"
      read "a/d/e", "world"
      read "a/d.conflict.bob.0001-01-01T00:00:00Z/f", "uh oh"
      rm "a/d/e"
      rm "a/d"
      write "a/b/c", "hello"
    end
    as bob do
      disable_updates
    end
    as alice do
      write "a/d/e", "world"
    end
    as bob, sync: false do
      write "a/b/f", "uh oh"
      rename "a/b", "a/d"
      reenable_updates
      lsdir "a/", { "d$" => "DIR", "d.conflict.bob.0001-01-01T00:00:00Z$" => "DIR", "d.conflict.bob.0001-01-01T00:00:00Z_\\(1\\)" => "DIR"  }
      lsdir "a/d", { "e" => "FILE" }
      lsdir "a/d.conflict.bob.0001-01-01T00:00:00Z_\(1\)", { "c" => "FILE", "f" => "FILE" }
      read "a/d/e", "world"
    end
    as alice do
      lsdir "a/", { "d$" => "DIR", "d.conflict.bob.0001-01-01T00:00:00Z$" => "DIR", "d.conflict.bob.0001-01-01T00:00:00Z_\\(1\\)" => "DIR"  }
      lsdir "a/d", { "e" => "FILE" }
      lsdir "a/d.conflict.bob.0001-01-01T00:00:00Z_\(1\)", { "c" => "FILE", "f" => "FILE" }
      read "a/d/e", "world"
    end
  end

  # bob and alice both write to the same file
  test :cr_conflict_write_file_double, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkfile "a/b", "hello"
    end
    as bob do
      disable_updates
    end
    as alice do
      write "a/b", "world"
    end
    as bob, sync: false do
      write "a/b", "uh oh"
      reenable_updates
      lsdir "a/", { "b$" => "FILE", "b.conflict.bob.0001-01-01T00:00:00Z" => "FILE" }
      read "a/b", "world"
      read "a/b.conflict.bob.0001-01-01T00:00:00Z", "uh oh"
    end
    as alice do
      lsdir "a/", { "b$" => "FILE", "b.conflict.bob.0001-01-01T00:00:00Z" => "FILE" }
      read "a/b", "world"
      read "a/b.conflict.bob.0001-01-01T00:00:00Z", "uh oh"
    end
    as bob do
      disable_updates
    end
    as alice do
      write "a/b", "another write"
    end
    as bob, sync: false do
      write "a/b", "uh oh again!"
      reenable_updates
      lsdir "a/", { "b$" => "FILE", "b.conflict.bob.0001-01-01T00:00:00Z$" => "FILE", "b.conflict.bob.0001-01-01T00:00:00Z_\\(1\\)" => "FILE" }
      read "a/b", "another write"
      read "a/b.conflict.bob.0001-01-01T00:00:00Z", "uh oh"
      read "a/b.conflict.bob.0001-01-01T00:00:00Z_\(1\)", "uh oh again!"
    end
    as alice do
      lsdir "a/", { "b$" => "FILE", "b.conflict.bob.0001-01-01T00:00:00Z$" => "FILE", "b.conflict.bob.0001-01-01T00:00:00Z_\\(1\\)" => "FILE" }
      read "a/b", "another write"
      read "a/b.conflict.bob.0001-01-01T00:00:00Z", "uh oh"
      read "a/b.conflict.bob.0001-01-01T00:00:00Z_\(1\)", "uh oh again!"
    end
  end

  # bob causes a rename cycle with a conflict while unstaged
  test :cr_rename_cycle_with_conflict, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkdir "a"
      mkdir "a/b"
      mkdir "a/c"
    end
    as bob do
      disable_updates
    end
    as alice do
      rename "a/c", "a/b/c"
    end
    as bob, sync: false do
      rename "a/b", "a/c/b"
      write "a/b", "uh oh"
      reenable_updates
      lsdir "a/", { "b$" => "DIR", "b.conflict.bob.0001-01-01T00:00:00Z" => "FILE" }
      read "a/b.conflict.bob.0001-01-01T00:00:00Z", "uh oh"
      lsdir "a/b/", { "c" => "DIR" }
      lsdir "a/b/c", { "b" => "SYM" }
      lsdir "a/b/c/b", { "c" => "DIR" }
    end
    as alice do
      lsdir "a/", { "b$" => "DIR", "b.conflict.bob.0001-01-01T00:00:00Z" => "FILE" }
      read "a/b.conflict.bob.0001-01-01T00:00:00Z", "uh oh"
      lsdir "a/b/", { "c" => "DIR" }
      lsdir "a/b/c", { "b" => "SYM" }
      lsdir "a/b/c/b", { "c" => "DIR" }
      write "a/b/d", "hello"
    end
    as bob do
      read "a/b/c/b/d", "hello"
    end
  end

  # bob causes a rename cycle with two conflicts while unstaged
  test :cr_rename_cycle_with_two_conflicts, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkdir "a"
      mkdir "a/b"
      mkdir "a/c"
    end
    as bob do
      disable_updates
    end
    as alice do
      rename "a/c", "a/b/c"
      write "a/b/c/b", "uh oh"
    end
    as bob, sync: false do
      rename "a/b", "a/c/b"
      write "a/b", "double uh oh"
      reenable_updates
      lsdir "a/", { "b$" => "DIR", "b.conflict.bob.0001-01-01T00:00:00Z" => "FILE" }
      read "a/b.conflict.bob.0001-01-01T00:00:00Z", "double uh oh"
      lsdir "a/b/", { "c" => "DIR" }
      lsdir "a/b/c", { "b$" => "SYM", "b.conflict.alice.0001-01-01T00:00:00Z" => "FILE" }
      lsdir "a/b/c/b", { "c" => "DIR" }
    end
    as alice do
      lsdir "a/", { "b$" => "DIR", "b.conflict.bob.0001-01-01T00:00:00Z" => "FILE" }
      read "a/b.conflict.bob.0001-01-01T00:00:00Z", "double uh oh"
      lsdir "a/b/", { "c" => "DIR" }
      lsdir "a/b/c", { "b$" => "SYM", "b.conflict.alice.0001-01-01T00:00:00Z" => "FILE" }
      lsdir "a/b/c/b", { "c" => "DIR" }
      write "a/b/d", "hello"
    end
    as bob do
      read "a/b/c/b/d", "hello"
    end
  end

  # bob causes a rename cycle with two conflicts while unstaged
  test :cr_rename_cycle_with_conflict_and_merged_dir, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkdir "a"
      mkdir "a/b"
      mkdir "a/c"
    end
    as bob do
      disable_updates
    end
    as alice do
      rename "a/c", "a/b/c"
      mkdir "a/b/c/b"
    end
    as bob, sync: false do
      rename "a/b", "a/c/b"
      write "a/b", "uh oh"
      reenable_updates
      lsdir "a/", { "b$" => "DIR", "b.conflict.bob.0001-01-01T00:00:00Z" => "FILE" }
      read "a/b.conflict.bob.0001-01-01T00:00:00Z", "uh oh"
      lsdir "a/b/", { "c" => "DIR" }
      lsdir "a/b/c", { "b$" => "DIR", "b.conflict.bob.0001-01-01T00:00:00Z" => "SYM" }
      lsdir "a/b/c/b.conflict.bob.0001-01-01T00:00:00Z", { "c" => "DIR" }
      lsdir "a/b/c/b", {}
    end
    as alice do
      lsdir "a/", { "b$" => "DIR", "b.conflict.bob.0001-01-01T00:00:00Z" => "FILE" }
      read "a/b.conflict.bob.0001-01-01T00:00:00Z", "uh oh"
      lsdir "a/b/", { "c" => "DIR" }
      lsdir "a/b/c", { "b$" => "DIR", "b.conflict.bob.0001-01-01T00:00:00Z" => "SYM" }
      lsdir "a/b/c/b.conflict.bob.0001-01-01T00:00:00Z", { "c" => "DIR" }
      lsdir "a/b/c/b", {}
      write "a/b/d", "hello"
    end
    as bob do
      read "a/b/c/b.conflict.bob.0001-01-01T00:00:00Z/d", "hello"
    end
  end
end
