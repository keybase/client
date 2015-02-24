//
//  KBInstallerView.h
//  Keybase
//
//  Created by Gabriel on 2/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

typedef NS_ENUM (NSInteger, KBInstallType) {
  KBInstallTypeNone,
  KBInstallTypeHomebrew,
  KBInstallTypeInstaller,
};

@interface KBInstaller : NSObject

- (void)checkInstall:(void (^)(NSError *error, BOOL installed, KBInstallType installType))completion;

@end
