//
//  KBInstallerView.h
//  Keybase
//
//  Created by Gabriel on 2/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBLauncher.h"

typedef NS_ENUM (NSInteger, KBInstallType) {
  KBInstallTypeNone,
  KBInstallTypeInstaller,
};

typedef void (^KBInstallCheck)(NSError *error, BOOL installed, KBInstallType installType);

@interface KBInstaller : NSObject

@property (readonly) KBLauncher *launcher;

- (instancetype)initWithLaunchCtl:(KBLauncher *)launcher;

/*!
  - installed: If YES, that means we did copied the launch services config and reloaded the service.
  - installType: The type of install we detected.
 */
- (void)checkInstall:(KBInstallCheck)completion;

/*!
 Install helper and KBFS.
 */
+ (void)installHelper:(KBOnCompletion)completion;

@end
