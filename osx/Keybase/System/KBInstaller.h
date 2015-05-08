//
//  KBInstallerView.h
//  Keybase
//
//  Created by Gabriel on 2/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBDefines.h"

typedef void (^KBInstallCheck)(NSArray */*of KBLaunchServiceInstall*/installs);

@interface KBInstaller : NSObject

- (void)checkInstall:(KBInstallCheck)completion;

/*!
 Install helper and Fuse.
 */
+ (void)installHelper:(KBOnCompletion)completion;

@end
