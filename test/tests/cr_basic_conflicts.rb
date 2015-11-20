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

  # bob creates a directory with the same name that alice used for a
  # file that used to exist at that location
  test :cr_conflict_cause_rename_of_merged_recreated_file, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkdir "a"
      write "a/b", "hello"
    end
    as bob do
      disable_updates
    end
    as alice do
      write "a/b", "world"
    end
    as bob, sync: false do
      rm "a/b"
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

  # bob renames a file over one modified by alice.
  test :cr_conflict_unmerged_rename_file_over_modified_file, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      write "a/b", "hello"
      write "a/c", "world"
    end
    as bob do
      disable_updates
    end
    as alice do
      write "a/b", "uh oh"
    end
    as bob, sync: false do
      rename "a/c", "a/b"
      reenable_updates
      lsdir "a/", { "b$" => "FILE", "b.conflict.bob.0001-01-01T00:00:00Z" => "FILE"  }
      read "a/b", "uh oh"
      read "a/b.conflict.bob.0001-01-01T00:00:00Z", "world"
    end
    as alice do
      lsdir "a/", { "b$" => "FILE", "b.conflict.bob.0001-01-01T00:00:00Z" => "FILE"  }
      read "a/b", "uh oh"
      read "a/b.conflict.bob.0001-01-01T00:00:00Z", "world"
    end
  end

  # bob renames a file from a new directory over one modified by alice.
  test :cr_conflict_unmerged_rename_file_in_new_dir_over_modified_file, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      write "a/b", "hello"
      write "a/c", "world"
    end
    as bob do
      disable_updates
    end
    as alice do
      write "a/b", "uh oh"
    end
    as bob, sync: false do
      rename "a/c", "e/c"
      rename "e/c", "a/b"
      reenable_updates
      lsdir "a/", { "b$" => "FILE", "b.conflict.bob.0001-01-01T00:00:00Z" => "FILE"  }
      lsdir "e/", {}
      read "a/b", "uh oh"
      read "a/b.conflict.bob.0001-01-01T00:00:00Z", "world"
    end
    as alice do
      lsdir "a/", { "b$" => "FILE", "b.conflict.bob.0001-01-01T00:00:00Z" => "FILE"  }
      lsdir "e/", {}
      read "a/b", "uh oh"
      read "a/b.conflict.bob.0001-01-01T00:00:00Z", "world"
    end
  end

  # bob renames a directory over a file modified by alice.
  test :cr_conflict_unmerged_rename_dir_over_modified_file, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      write "a/b", "hello"
      write "a/c/d", "world"
    end
    as bob do
      disable_updates
    end
    as alice do
      write "a/b", "uh oh"
    end
    as bob, sync: false do
      rename "a/c", "a/b"
      reenable_updates
      lsdir "a/", { "b$" => "DIR", "b.conflict.alice.0001-01-01T00:00:00Z" => "FILE"  }
      read "a/b/d", "world"
      read "a/b.conflict.alice.0001-01-01T00:00:00Z", "uh oh"
    end
    as alice do
      lsdir "a/", { "b$" => "DIR", "b.conflict.alice.0001-01-01T00:00:00Z" => "FILE"  }
      read "a/b/d", "world"
      read "a/b.conflict.alice.0001-01-01T00:00:00Z", "uh oh"
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

  # alice renames a file over one modified by bob.
  test :cr_conflict_merged_rename_file_over_modified_file, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      write "a/b", "hello"
      write "a/c", "world"
    end
    as bob do
      disable_updates
    end
    as alice do
      rename "a/c", "a/b"
    end
    as bob, sync: false do
      write "a/b", "uh oh"
      reenable_updates
      lsdir "a/", { "b$" => "FILE", "b.conflict.bob.0001-01-01T00:00:00Z" => "FILE"  }
      read "a/b", "world"
      read "a/b.conflict.bob.0001-01-01T00:00:00Z", "uh oh"
    end
    as alice do
      lsdir "a/", { "b$" => "FILE", "b.conflict.bob.0001-01-01T00:00:00Z" => "FILE"  }
      read "a/b", "world"
      read "a/b.conflict.bob.0001-01-01T00:00:00Z", "uh oh"
    end
  end

  # alice renames a directory over a file modified by bob.
  test :cr_conflict_merged_rename_dir_over_modified_file, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      write "a/b", "hello"
      write "a/c/d", "world"
    end
    as bob do
      disable_updates
    end
    as alice do
      rename "a/c", "a/b"
    end
    as bob, sync: false do
      write "a/b", "uh oh"
      reenable_updates
      lsdir "a/", { "b$" => "DIR", "b.conflict.bob.0001-01-01T00:00:00Z" => "FILE"  }
      read "a/b/d", "world"
      read "a/b.conflict.bob.0001-01-01T00:00:00Z", "uh oh"
    end
    as alice do
      lsdir "a/", { "b$" => "DIR", "b.conflict.bob.0001-01-01T00:00:00Z" => "FILE"  }
      read "a/b/d", "world"
      read "a/b.conflict.bob.0001-01-01T00:00:00Z", "uh oh"
    end
  end

  # alice and both both rename the same file, causing a copy.
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
      reenable_updates
      lsdir "a/", { "c" => "FILE", "d" => "FILE" }
      read "a/c", "hello"
      read "a/d", "hello"
    end
    as alice do
      lsdir "a/", { "c" => "FILE", "d" => "FILE" }
      read "a/c", "hello"
      read "a/d", "hello"
      write "a/c", "world"
    end
    as bob do
      read "a/c", "world"
      read "a/d", "hello"
    end
  end

  # alice and both both rename the same executable file, causing a copy.
  test :cr_conflict_rename_same_ex, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      write "a/b", "hello"
      setex "a/b", true
    end
    as bob do
      disable_updates
    end
    as alice do
      rename "a/b", "a/c"
    end
    as bob, sync: false do
      rename "a/b", "a/d"
      reenable_updates
      lsdir "a/", { "c" => "EXEC", "d" => "EXEC" }
      read "a/c", "hello"
      read "a/d", "hello"
    end
    as alice do
      lsdir "a/", { "c" => "EXEC", "d" => "EXEC" }
      read "a/c", "hello"
      read "a/d", "hello"
      write "a/c", "world"
    end
    as bob do
      read "a/c", "world"
      read "a/d", "hello"
    end
  end

  # alice and both both rename the same symlink.
  test :cr_conflict_rename_same_symlink, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      write "a/foo", "hello"
      link "a/b", "foo"
    end
    as bob do
      disable_updates
    end
    as alice do
      rename "a/b", "a/c"
    end
    as bob, sync: false do
      rename "a/b", "a/d"
      reenable_updates
      lsdir "a/", { "foo" => "FILE", "c" => "SYM", "d" => "SYM" }
      read "a/c", "hello"
      read "a/d", "hello"
    end
    as alice do
      lsdir "a/", { "foo" => "FILE", "c" => "SYM", "d" => "SYM" }
      read "a/c", "hello"
      read "a/d", "hello"
      write "a/c", "world"
    end
    as bob do
      read "a/c", "world"
      read "a/d", "world"
    end
  end

  # alice and bob both rename the same directory, causing a symlink to
  # be created.
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
      reenable_updates
      lsdir "a/", { "d" => "DIR", "e" => "SYM" }
      read "a/d/c", "hello"
      read "a/e/c", "hello"
    end
    as alice do
      lsdir "a/", { "d" => "DIR", "e" => "SYM" }
      read "a/d/c", "hello"
      read "a/e/c", "hello"
      write "a/d/f", "world"
      read "a/e/f", "world"
    end
    as bob do
      read "a/e/f", "world"
    end
  end

  # alice and bob both rename the same directory, causing a symlink to
  # be created.
  test :cr_conflict_rename_same_dir_upward, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      write "a/b/c/d/e/foo", "hello"
    end
    as bob do
      disable_updates
    end
    as alice do
      rename "a/b/c/d/e", "a/e"
    end
    as bob, sync: false do
      rename "a/b/c/d/e", "a/b/c/d/f"
      reenable_updates
      lsdir "a/", { "b" => "DIR", "e" => "DIR" }
      lsdir "a/e", { "foo" => "FILE" }
      lsdir "a/b/c/d", { "f" => "SYM" }
      lsdir "a/b/c/d/f", { "foo" => "FILE" }
      read "a/e/foo", "hello"
      lsdir "a/b/c/d/f", { "foo" => "FILE" }
    end
    as alice do
      lsdir "a/", { "b" => "DIR", "e" => "DIR" }
      lsdir "a/e", { "foo" => "FILE" }
      lsdir "a/b/c/d", { "f" => "SYM" }
      lsdir "a/b/c/d/f", { "foo" => "FILE" }
      read "a/e/foo", "hello"
      lsdir "a/b/c/d/f", { "foo" => "FILE" }
      write "a/e/foo2", "world"
    end
    as bob do
      read "a/b/c/d/f/foo2", "world"
    end
  end

  # alice and bob both rename the same directory, causing a symlink to
  # be created.
  test :cr_conflict_rename_same_dir_merged_upward, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      write "a/b/c/d/e/foo", "hello"
    end
    as bob do
      disable_updates
    end
    as alice do
      rename "a/b/c/d/e", "a/b/c/d/f"
    end
    as bob, sync: false do
      rename "a/b/c/d/e", "a/e"
      reenable_updates
      lsdir "a/", { "b" => "DIR", "e" => "SYM" }
      lsdir "a/e", { "foo" => "FILE" }
      lsdir "a/b/c/d", { "f" => "DIR" }
      lsdir "a/b/c/d/f", { "foo" => "FILE" }
      read "a/e/foo", "hello"
      lsdir "a/b/c/d/f", { "foo" => "FILE" }
    end
    as alice do
      lsdir "a/", { "b" => "DIR", "e" => "SYM" }
      lsdir "a/e", { "foo" => "FILE" }
      lsdir "a/b/c/d", { "f" => "DIR" }
      lsdir "a/b/c/d/f", { "foo" => "FILE" }
      read "a/e/foo", "hello"
      lsdir "a/b/c/d/f", { "foo" => "FILE" }
      write "a/e/foo2", "world"
    end
    as bob do
      read "a/b/c/d/f/foo2", "world"
    end
  end

  test :cr_conflict_rename_same_dir_downward, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      write "a/b/foo", "hello"
    end
    as bob do
      disable_updates
    end
    as alice do
      rename "a/b", "a/c/d/e/f"
    end
    as bob, sync: false do
      rename "a/b", "a/g"
      reenable_updates
      lsdir "a/", { "c" => "DIR", "g" => "SYM" }
      lsdir "a/c/d/e/f", { "foo" => "FILE" }
      lsdir "a/g", { "foo" => "FILE" }
      read "a/c/d/e/f/foo", "hello"
      read "a/g/foo", "hello"
    end
    as alice do
      lsdir "a/", { "c" => "DIR", "g" => "SYM" }
      lsdir "a/c/d/e/f", { "foo" => "FILE" }
      lsdir "a/g", { "foo" => "FILE" }
      read "a/c/d/e/f/foo", "hello"
      read "a/g/foo", "hello"
      write "a/c/d/e/f/foo2", "world"
    end
    as bob do
      read "a/g/foo2", "world"
    end
  end

  test :cr_conflict_rename_same_dir_sideways, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      write "a/b/c/d/foo", "hello"
    end
    as bob do
      disable_updates
    end
    as alice do
      rename "a/b/c/d", "a/e/f/g"
    end
    as bob, sync: false do
      rename "a/b/c/d", "a/b/c/h"
      reenable_updates
      lsdir "a/e/f", { "g" => "DIR" }
      lsdir "a/b/c", { "h" => "SYM" }
      lsdir "a/e/f/g", { "foo" => "FILE" }
      lsdir "a/b/c/h", { "foo" => "FILE" }
      read "a/e/f/g/foo", "hello"
      read "a/b/c/h/foo", "hello"
    end
    as alice do
      lsdir "a/e/f", { "g" => "DIR" }
      lsdir "a/b/c", { "h" => "SYM" }
      lsdir "a/e/f/g", { "foo" => "FILE" }
      lsdir "a/b/c/h", { "foo" => "FILE" }
      read "a/e/f/g/foo", "hello"
      read "a/b/c/h/foo", "hello"
      write "a/e/f/g/foo2", "world"
    end
    as bob do
      read "a/b/c/h/foo2", "world"
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
