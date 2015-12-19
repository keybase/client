# These tests all do one conflict-free operation while a user is unstaged.
module Test
  # bob writes a multi-block file while unmerged, no conflicts
  test :cr_unmerged_write_multiblock_file, block_size: 20, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkdir "a"
    end
    as bob do
      disable_updates
    end
    as alice do
      write "a/foo", "hello"
    end
    as bob do
      write "a/b", "0123456789" * 15
      reenable_updates
      lsdir "a/", { "b" => "FILE", "foo" => "FILE" }
      read "a/b", "0123456789" * 15
      read "a/foo", "hello"
    end
    as alice do
      lsdir "a/", { "b" => "FILE", "foo" => "FILE" }
      read "a/b", "0123456789" * 15
      read "a/foo", "hello"
    end
  end

  # bob writes a multi-block file that conflicts with a file created by alice
  test :cr_conflict_unmerged_write_multiblock_file, block_size: 20, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkdir "a"
    end
    as bob do
      disable_updates
    end
    as alice do
      write "a/b", "hello"
    end
    as bob, sync: false do
      write "a/b", "0123456789" * 15
      reenable_updates
      lsdir "a/", { "b$" => "FILE", "b.conflict.bob.0001-01-01T00:00:00Z" => "FILE" }
      read "a/b", "hello"
      read "a/b.conflict.bob.0001-01-01T00:00:00Z", "0123456789" * 15
    end
    as alice do
      lsdir "a/", { "b$" => "FILE", "b.conflict.bob.0001-01-01T00:00:00Z" => "FILE" }
      read "a/b", "hello"
      read "a/b.conflict.bob.0001-01-01T00:00:00Z", "0123456789" * 15
    end
  end

  # alice writes a multi-block file that conflicts with a directory
  # created by alice
  test :cr_conflict_merged_write_multiblock_file, block_size: 20, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkdir "a"
    end
    as bob do
      disable_updates
    end
    as alice do
      write "a/b", "0123456789" * 15
    end
    as bob, sync: false do
      write "a/b/c", "hello"
      reenable_updates
      lsdir "a/", { "b$" => "DIR", "b.conflict.alice.0001-01-01T00:00:00Z" => "FILE" }
      read "a/b/c", "hello"
      read "a/b.conflict.alice.0001-01-01T00:00:00Z", "0123456789" * 15
    end
    as alice do
      lsdir "a/", { "b$" => "DIR", "b.conflict.alice.0001-01-01T00:00:00Z" => "FILE" }
      read "a/b/c", "hello"
      read "a/b.conflict.alice.0001-01-01T00:00:00Z", "0123456789" * 15
    end
  end

  # bob resurrects a file that was removed by alice
  test :cr_conflict_write_to_removed_multiblock_file, block_size: 20, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkdir "a"
      write "a/b", "0123456789" * 15
    end
    as bob do
      disable_updates
    end
    as alice do
      rm "a/b"
    end
    as bob, sync: false do
      write "a/b", "9876543210" * 15
      reenable_updates
      lsdir "a/", { "b$" => "FILE" }
      read "a/b", "9876543210" * 15
    end
    as alice do
      lsdir "a/", { "b$" => "FILE" }
      read "a/b", "9876543210" * 15
    end
  end

  # bob makes a file that was removed by alice executable
  test :cr_conflict_setex_to_removed_multiblock_file, block_size: 20, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkdir "a"
      write "a/b", "0123456789" * 15
    end
    as bob do
      disable_updates
    end
    as alice do
      rm "a/b"
    end
    as bob, sync: false do
      setex "a/b", true
      reenable_updates
      lsdir "a/", { "b$" => "EXEC" }
      read "a/b", "0123456789" * 15
    end
    as alice do
      lsdir "a/", { "b$" => "EXEC" }
      read "a/b", "0123456789" * 15
    end
  end

  # bob moves a file that was removed by alice executable
  test :cr_conflict_move_removed_multiblock_file, block_size: 20, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      mkdir "a"
      write "a/b", "0123456789" * 15
    end
    as bob do
      disable_updates
    end
    as alice do
      rm "a/b"
    end
    as bob, sync: false do
      rename "a/b", "a/c"
      reenable_updates
      lsdir "a/", { "c$" => "FILE" }
      read "a/c", "0123456789" * 15
    end
    as alice do
      lsdir "a/", { "c$" => "FILE" }
      read "a/c", "0123456789" * 15
    end
  end

  # TODO: test md.RefBytes, md.UnrefBytes, and md.DiskUsage as well!
end
