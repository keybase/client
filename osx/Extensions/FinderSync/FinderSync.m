//
//  FinderSync.m
//  FinderSync
//
//  Created by Gabriel on 6/10/15.
//  Copyright (c) 2017 Keybase. All rights reserved.
//

#import "FinderSync.h"

#import <KBKit/KBFinder.h>
#import <KBKit/KBWorkspace.h>

#define KBLog NSLog

@interface FinderSync ()
@property KBFinder *finder;
@end

@implementation FinderSync

- (instancetype)init {
  if ((self = [super init])) {
    [KBWorkspace setupLogging];
    KBLog(@"FinderSync init");    
    _finder = [[KBFinder alloc] initWithFinderSyncController:FIFinderSyncController.defaultController];
  }
  return self;
}

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
  [_finder badgeIdForPath:URL.filePathURL.path completion:^(NSString *badgeId) {
    KBLog(@"Badge for path: %@: %@", URL.filePathURL.path, badgeId);
    [FIFinderSyncController.defaultController setBadgeIdentifier:badgeId forURL:URL];
  }];
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

