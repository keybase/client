//
//  KBInstallerView.h
//  Keybase
//
//  Created by Gabriel on 2/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBDefines.h"
#import "KBEnvironment.h"

typedef void (^KBInstallCheck)(NSArray */*of KBLaunchServiceInstall*/installs);

@interface KBInstaller : NSObject

- (instancetype)initWithEnvironment:(KBEnvironment *)environment;

- (void)checkInstall:(KBInstallCheck)completion;

/*!
 Install helper and Fuse.
 */
+ (void)installHelper:(KBOnCompletion)completion;

@end
