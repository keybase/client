//
//  FinderSync.m
//  FinderSync
//
//  Created by Gabriel on 6/10/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import "FinderSync.h"

#import <KBKit/KBWorkspace.h>

#define KBLog NSLog

@interface FinderSync ()
@property NSString *mountDir;
@end

#define KBBadgeAvailable (@"available")
#define KBBadgeUnavailable (@"unavailable")

@implementation FinderSync

- (instancetype)init {
  if ((self = [super init])) {
    NSString *mountDir = [KBWorkspace.userDefaults objectForKey:@"MountDir"];
    if (mountDir) {
      NSLog(@"Finder sync using: %@", mountDir);
      FIFinderSyncController.defaultController.directoryURLs = [NSSet setWithObject:[NSURL fileURLWithPath:mountDir]];
    }
    [FIFinderSyncController.defaultController setBadgeImage:[NSImage imageNamed:NSImageNameStatusUnavailable] label:@"Unavailable" forBadgeIdentifier:KBBadgeUnavailable];
    [FIFinderSyncController.defaultController setBadgeImage:[NSImage imageNamed:NSImageNameStatusAvailable] label:@"Available" forBadgeIdentifier:KBBadgeAvailable];
  }
  return self;
}

#pragma mark -

- (void)beginObservingDirectoryAtURL:(NSURL *)URL {
  // The user is now seeing the container's contents.
  // If they see it in more than one view at a time, we're only told once.
  KBLog(@"beginObservingDirectoryAtURL:%@", URL.filePathURL);
}

- (void)endObservingDirectoryAtURL:(NSURL *)URL {
  // The user is no longer seeing the container's contents.
  KBLog(@"endObservingDirectoryAtURL:%@", URL.filePathURL);
}

- (void)requestBadgeIdentifierForURL:(NSURL *)URL {
  KBLog(@"requestBadgeIdentifierForURL:%@", URL.filePathURL);
  [FIFinderSyncController.defaultController setBadgeIdentifier:KBBadgeUnavailable forURL:URL];
}

/*
#pragma mark Menu/Toolbar

- (NSString *)toolbarItemName {
  return @"Keybase";
}

- (NSString *)toolbarItemToolTip {
  return @"Keybase: ?";
}

- (NSImage *)toolbarItemImage {
  return [NSImage imageNamed:NSImageNameCaution];
}

- (NSMenu *)menuForMenuKind:(FIMenuKind)whichMenu {
  NSMenu *menu = [[NSMenu alloc] initWithTitle:@""];
  [menu addItemWithTitle:@"Open" action:@selector(open:) keyEquivalent:@""];
  return menu;
}

- (IBAction)open:(id)sender {
  NSURL *target = [[FIFinderSyncController defaultController] targetedURL];
  NSArray *items = [[FIFinderSyncController defaultController] selectedItemURLs];

  KBLog(@"%@, target: %@, items:", [sender title], [target filePathURL]);
  [items enumerateObjectsUsingBlock: ^(id obj, NSUInteger idx, BOOL *stop) {
    KBLog(@" %@", [obj filePathURL]);
  }];
}
 */

@end

