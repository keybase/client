//
//  KBInstallerView.h
//  Keybase
//
//  Created by Gabriel on 2/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBLaunchCtl.h"

typedef NS_ENUM (NSInteger, KBInstallType) {
  KBInstallTypeNone,
  KBInstallTypeInstaller,
};

typedef void (^KBInstallCheck)(NSError *error, BOOL installed, KBInstallType installType);

@interface KBInstaller : NSObject

@property (readonly) KBLaunchCtl *launchCtl;

- (instancetype)initWithLaunchCtl:(KBLaunchCtl *)launchCtl;

/*!
  - installed: If YES, that means we did copied the launch services config and reloaded the service.
  - installType: The type of install we detected.
 */
- (void)checkInstall:(KBInstallCheck)completion;

// For helper install
+ (BOOL)installServiceWithName:(NSString *)name error:(NSError **)error;

@end
