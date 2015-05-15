//
//  KBInstallerView.h
//  Keybase
//
//  Created by Gabriel on 2/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppDefines.h"
#import "KBEnvironment.h"


@interface KBInstaller : NSObject

@property (readonly) NSArray *installActions;

- (instancetype)initWithEnvironment:(KBEnvironment *)environment components:(NSArray *)components;

- (void)installStatus:(void (^)(BOOL needsInstall))completion;

- (void)install:(dispatch_block_t)completion;

- (NSArray *)installActionsNeeded;

@end
