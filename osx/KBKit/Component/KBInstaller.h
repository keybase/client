//
//  KBInstallerView.h
//  Keybase
//
//  Created by Gabriel on 2/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>


#import "KBEnvironment.h"

@interface KBInstaller : NSObject

- (void)installStatus:(NSArray *)installActions completion:(dispatch_block_t)completion;
- (void)install:(NSArray *)installActions completion:(dispatch_block_t)completion;
- (void)uninstall:(NSArray *)installables completion:(dispatch_block_t)completion;

- (void)installStatusWithEnvironment:(KBEnvironment *)environment completion:(void (^)(BOOL needsInstall))completion;
- (void)installWithEnvironment:(KBEnvironment *)environment completion:(void (^)(NSArray *installActions))completion;
- (void)uninstallWithEnvironment:(KBEnvironment *)environment completion:(void (^)(NSArray *installActions))completion;

@end
