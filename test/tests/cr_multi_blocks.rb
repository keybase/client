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

  # Test a resurrected rm'd merged file

  # TODO: test md.RefBlocks, md.UnrefBlocks, and md.DiskUsage as well!
end
