# These tests all do one conflict-free operation while a user is unstaged.
module Test
  # alice writes a multi-block file, and bob reads it
  test :write_multiblock_file, block_size: 20, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      write "a/b", "0123456789" * 15
    end
    as bob do
      read "a/b", "0123456789" * 15
    end
  end

  # bob removes a multiblock file written by alice (checks that state
  # is cleaned up)
  test :rm_multiblock_file, block_size: 20, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      write "a/b", "0123456789" * 15
    end
    as bob do
      read "a/b", "0123456789" * 15
      rm "a/b"
    end
    as alice do
      lsdir "a/", { }
    end
  end

  # bob renames something over a multiblock file written by alice
  # (checks that state is cleaned up)
  test :rename_over_multiblock_file, block_size: 20, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      write "a/b", "0123456789" * 15
      write "a/c", "hello"
    end
    as bob do
      read "a/b", "0123456789" * 15
      read "a/c", "hello"
      rename "a/c", "a/b"
    end
    as alice do
      read "a/b", "hello"
      lsdir "a/", { "b" => "FILE" }
    end
  end

  # bob writes a second copy of a multiblock file written by alice
  # (tests dedupping, but hard to verify that precisely here).
  test :copy_multiblock_file, block_size: 20, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      write "a/b", "0123456789" * 15
    end
    as bob do
      read "a/b", "0123456789" * 15
      write "a/c", "0123456789" * 15
    end
    as alice do
      read "a/b", "0123456789" * 15
      read "a/c", "0123456789" * 15
      rm "a/b"
    end
    as bob do
      read "a/c", "0123456789" * 15
    end
  end

  # When block changes are unembedded, make sure other users can read
  # and apply them.
  test :read_unembedded_block_changes, block_change_size: 5, writers: ["alice", "bob"] do |alice, bob|
    as alice do
      write "a/b", "hello"
    end
    as bob do
      read "a/b", "hello"
      write "a/c", "hello2"
      write "a/d", "hello3"
      write "a/e", "hello4"
      write "a/f", "hello5"
    end
    as alice do
      lsdir "a", { "b" => "FILE", "c" => "FILE", "d" => "FILE", "e" => "FILE", "f" => "FILE" }
      read "a/b", "hello"
      read "a/c", "hello2"
      read "a/d", "hello3"
      read "a/e", "hello4"
      read "a/f", "hello5"
    end
  end
end
