# These tests all do multiple operations while a user is unstaged.
module Test
  # bob renames a non-conflicting file into a new directory while unstaged
  test :cr_unmerged_rename_into_new_dir, writers: ["alice", "bob"] do |alice, bob|
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

  # alice renames a non-conflicting file into a new directory while
  # bob is unstaged.
  test :cr_merged_rename_into_new_dir, writers: ["alice", "bob"] do |alice, bob|
   as alice do
      mkfile "a/b", "hello"
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

  # bob causes a simple rename cycle while unstaged
  test :cr_rename_cycle, writers: ["alice", "bob"] do |alice, bob|
   as alice do
      mkdir "a"
      mkdir "b"
   end
    as bob do
      disable_updates
    end
    as alice do
      rename "b", "a/b"
    end
    as bob, sync: false do
      rename "a", "b/a"
      reenable_updates
      lsdir "a/", { "b" => "DIR" }
      lsdir "a/b/", { "a" => "SYM" }
      lsdir "a/b/a", { "b" => "DIR" }
    end
    as alice do
      lsdir "a/", { "b" => "DIR" }
      lsdir "a/b/", { "a" => "SYM" }
      lsdir "a/b/a", { "b" => "DIR" }
      write "a/c", "hello"
    end
    as bob do
      read "a/b/a/c", "hello"
    end
  end

  # bob causes a complicated rename cycle while unstaged
  test :cr_complex_rename_cycle, writers: ["alice", "bob"] do |alice, bob|
   as alice do
      mkdir "a"
      mkdir "b"
   end
    as bob do
      disable_updates
    end
    as alice do
      rename "b", "a/b"
    end
    as bob, sync: false do
      mkdir "b/c"
      rename "a", "b/c/a"
      reenable_updates
      lsdir "a/", { "b" => "DIR" }
      lsdir "a/b/", { "c" => "DIR" }
      lsdir "a/b/c", { "a" => "SYM" }
      lsdir "a/b/c/a", { "b" => "DIR" }
    end
    as alice do
      lsdir "a/", { "b" => "DIR" }
      lsdir "a/b/", { "c" => "DIR" }
      lsdir "a/b/c", { "a" => "SYM" }
      lsdir "a/b/c/a", { "b" => "DIR" }
      write "a/d", "hello"
    end
    as bob do
      read "a/b/c/a/d", "hello"
    end
  end

  # bob causes a complicated and large rename cycle while unstaged
  test :cr_complex_large_rename_cycle, writers: ["alice", "bob"] do |alice, bob|
   as alice do
      mkdir "a/b/c"
      mkdir "d/e/f"
   end
    as bob do
      disable_updates
    end
    as alice do
      rename "d", "a/b/c/d"
    end
    as bob, sync: false do
      mkdir "d/e/f/g/h/i"
      rename "a", "d/e/f/g/h/i/a"
      reenable_updates
      lsdir "a/b/c/d/e/f/g/h/i", { "a" => "SYM" }
      lsdir "a/b/c/d/e/f/g/h/i/a", { "b" => "DIR" }
    end
    as alice do
      lsdir "a/b/c/d/e/f/g/h/i", { "a" => "SYM" }
      lsdir "a/b/c/d/e/f/g/h/i/a", { "b" => "DIR" }
      write "a/j", "hello"
    end
    as bob do
      read "a/b/c/d/e/f/g/h/i/a/j", "hello"
    end
  end

  # bob and alice do a lot of complex renames cycle while unstaged
  test :cr_complex_rename_no_cycle, writers: ["alice", "bob"] do |alice, bob|
   as alice do
      mkdir "a/b/c/d/e/f/g"
   end
    as bob do
      disable_updates
    end
    as alice do
      rename "a/b/c/d/e/f", "f"
      rename "a/b/c/d", "f/g/d"
      rename "a/b", "f/g/d/e/b"
    end
    as bob, sync: false do
      rename "a/b/c/d/e/f/g", "g"
      rename "a/b/c/d/e", "g/e"
      rename "a/b/c", "g/e/f/c"
      rename "a", "g/e/f/c/d/a"
      reenable_updates
      lsdir "f", { "c" => "DIR" }
      lsdir "f/c", {}
      lsdir "g", { "e" => "DIR", "d" => "DIR" }
      lsdir "g/e", { "b" => "DIR" }
      lsdir "g/e/b", {}
      lsdir "g/d", { "a" => "DIR" }
    end
    as alice do
      lsdir "f", { "c" => "DIR" }
      lsdir "f/c", {}
      lsdir "g", { "e" => "DIR", "d" => "DIR" }
      lsdir "g/e", { "b" => "DIR" }
      lsdir "g/e/b", {}
      lsdir "g/d", { "a" => "DIR" }
    end
  end

  # bob renames a file while unmerged, at the same time alice writes to it
  test :cr_unmerged_rename_with_parallel_write, writers: ["alice", "bob"] do |alice, bob|
   as alice do
      mkdir "a"
      mkdir "b"
      write "a/foo", "hello"
   end
    as bob do
      disable_updates
    end
    as alice do
      write "a/foo", "goodbye"
    end
    as bob, sync: false do
      rename "a/foo", "b/bar"
      reenable_updates
      lsdir "a", {}
      lsdir "b", { "bar" => "FILE" }
      read "b/bar", "goodbye"
    end
    as alice do
      lsdir "a", {}
      lsdir "b", { "bar" => "FILE" }
      read "b/bar", "goodbye"
    end
  end

  # bob makes a non-conflicting file executable while alice writes to it
  test :cr_unmerged_setex_parallel_write, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkfile "a/b", "hello"
    end
    as bob do
      disable_updates
    end
    as alice do
      write "a/b", "goodbye"
    end
    as bob, sync: false do
      setex "a/b", true
      reenable_updates
      lsdir "a/", { "b" => "EXEC"}
      read "a/b", "goodbye"
    end
    as alice do
      lsdir "a/", { "b" => "EXEC"}
      read "a/b", "goodbye"
    end
  end

  # alice makes a non-conflicting file executable while bob writes to it
  test :cr_merged_setex_parallel_write, writers: ["alice", "bob"] do |alice, bob|
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
      write "a/b", "goodbye"
      reenable_updates
      lsdir "a/", { "b" => "EXEC"}
      read "a/b", "goodbye"
    end
    as alice do
      lsdir "a/", { "b" => "EXEC"}
      read "a/b", "goodbye"
    end
  end

  # bob writes to a file while alice removes it
  test :cr_unmerged_write_to_removed_file, writers: ["alice", "bob"] do |alice, bob|
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
      write "a/b", "goodbye"
      reenable_updates
      lsdir "a/", { "b" => "FILE"}
      read "a/b", "goodbye"
    end
    as alice do
      lsdir "a/", { "b" => "FILE"}
      read "a/b", "goodbye"
    end
  end

  # bob removes a file while alice writes to it
  test :cr_merged_write_to_removed_file, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkfile "a/b", "hello"
    end
    as bob do
      disable_updates
    end
    as alice do
      write "a/b", "goodbye"
    end
    as bob, sync: false do
      rm "a/b"
      reenable_updates
      lsdir "a/", { "b" => "FILE"}
      read "a/b", "goodbye"
    end
    as alice do
      lsdir "a/", { "b" => "FILE"}
      read "a/b", "goodbye"
    end
  end

  # bob writes to a file to a directory that alice removes
  test :cr_unmerged_create_in_removed_dir, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkfile "a/b/c/d/e", "hello"
    end
    as bob do
      disable_updates
    end
    as alice do
      rm "a/b/c/d/e"
      rmdir "a/b/c/d"
      rmdir "a/b/c"
      rmdir "a/b"
    end
    as bob, sync: false do
      write "a/b/c/d/f", "goodbye"
      reenable_updates
      lsdir "a/b/c/d", { "f" => "FILE"}
      read "a/b/c/d/f", "goodbye"
    end
    as alice do
      lsdir "a/b/c/d", { "f" => "FILE"}
      read "a/b/c/d/f", "goodbye"
    end
  end

  # alice writes to a file to a directory that bob removes
  test :cr_merged_create_in_removed_dir, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkfile "a/b/c/d/e", "hello"
    end
    as bob do
      disable_updates
    end
    as alice do
      write "a/b/c/d/f", "goodbye"
    end
    as bob, sync: false do
      rm "a/b/c/d/e"
      rmdir "a/b/c/d"
      rmdir "a/b/c"
      rmdir "a/b"
      reenable_updates
      lsdir "a/b/c/d", { "f" => "FILE"}
      read "a/b/c/d/f", "goodbye"
    end
    as alice do
      lsdir "a/b/c/d", { "f" => "FILE"}
      read "a/b/c/d/f", "goodbye"
    end
  end

  # bob writes a file while unmerged, at the same time alice renames it
  test :cr_merged_rename_with_parallel_write, writers: ["alice", "bob"] do |alice, bob|
   as alice do
      mkdir "a"
      mkdir "b"
      write "a/foo", "hello"
   end
    as bob do
      disable_updates
    end
    as alice do
      rename "a/foo", "b/bar"
    end
    as bob, sync: false do
      write "a/foo", "goodbye"
      reenable_updates
      lsdir "a", {}
      lsdir "b", { "bar" => "FILE" }
      read "b/bar", "goodbye"
    end
    as alice do
      lsdir "a", {}
      lsdir "b", { "bar" => "FILE" }
      read "b/bar", "goodbye"
    end
  end

  # bob has two back-to-back resolutions
  test :cr_double_resolution, writers: ["alice", "bob"] do |alice, bob|
   as alice do
      mkdir "a/b"
   end
    as bob do
      disable_updates
    end
    as alice do
      write "a/b/c", "hello"
    end
    as bob, sync: false do
      write "a/b/d", "goodbye"
      reenable_updates
      lsdir "a", { "b" => "DIR"}
      lsdir "a/b", { "c" => "FILE", "d" => "FILE" }
      read "a/b/c", "hello"
      read "a/b/d", "goodbye"
    end
    as alice do
      lsdir "a", { "b" => "DIR"}
      lsdir "a/b", { "c" => "FILE", "d" => "FILE" }
      read "a/b/c", "hello"
      read "a/b/d", "goodbye"
      # Make a few more revisions
      write "a/b/e", "hello"
      write "a/b/f", "goodbye"
    end
    as bob do
      read "a/b/e", "hello"
      read "a/b/f", "goodbye"
      disable_updates
    end
    as alice do
      rm "a/b/f"
    end
    as bob, sync: false do
      rm "a/b/e"
      reenable_updates
      lsdir "a", { "b" => "DIR"}
      lsdir "a/b", { "c" => "FILE", "d" => "FILE" }
      read "a/b/c", "hello"
      read "a/b/d", "goodbye"
    end
    as alice do
      lsdir "a", { "b" => "DIR"}
      lsdir "a/b", { "c" => "FILE", "d" => "FILE" }
      read "a/b/c", "hello"
      read "a/b/d", "goodbye"
    end
  end

  # bob makes files in a directory renamed by alice
  test :cr_unmerged_make_files_in_renamed_dir, writers: ["alice", "bob"] do |alice, bob|
   as alice do
      mkdir "a/b"
   end
    as bob do
      disable_updates
    end
    as alice do
      rename "a/b", "b"
    end
    as bob, sync: false do
      write "a/b/c", "hello"
      write "a/b/d", "goodbye"
      reenable_updates
      lsdir "a", {}
      lsdir "b", { "c" => "FILE", "d" => "FILE" }
      read "b/c", "hello"
      read "b/d", "goodbye"
    end
    as alice do
      lsdir "a", {}
      lsdir "b", { "c" => "FILE", "d" => "FILE" }
      read "b/c", "hello"
      read "b/d", "goodbye"
    end
  end

  # bob makes files in a directory renamed by alice
  test :cr_merged_make_files_in_renamed_dir, writers: ["alice", "bob"] do |alice, bob|
   as alice do
      mkdir "a/b"
   end
    as bob do
      disable_updates
    end
    as alice do
      write "a/b/c", "hello"
      write "a/b/d", "goodbye"
    end
    as bob, sync: false do
      rename "a/b", "b"
      reenable_updates
      lsdir "a", {}
      lsdir "b", { "c" => "FILE", "d" => "FILE" }
      read "b/c", "hello"
      read "b/d", "goodbye"
    end
    as alice do
      lsdir "a", {}
      lsdir "b", { "c" => "FILE", "d" => "FILE" }
      read "b/c", "hello"
      read "b/d", "goodbye"
    end
  end
end
