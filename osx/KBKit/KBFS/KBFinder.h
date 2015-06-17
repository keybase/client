//
//  KBFinder.h
//  Keybase
//
//  Created by Gabriel on 6/16/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <FinderSync/FinderSync.h>

typedef NS_ENUM (NSInteger, KBFSFileStatus) {
  KBFSFileStatusUnknown = 0,
  KBFSFileStatusNone = 1,
  KBFSFileStatusUnavailable = 2,
  KBFSFileStatusPartiallyAvailable = 3,
  KBFSFileStatusAvailable = 4,
};

@interface KBFinder : NSObject

- (instancetype)initWithFinderSyncController:(FIFinderSyncController *)finderSyncController;

- (void)badgeIdForPath:(NSString *)path completion:(void (^)(NSString *badgeId))completion;

@end
