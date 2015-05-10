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

typedef void (^KBInstallActions)(NSArray */*of KBInstallAction*/installActions);

@interface KBInstaller : NSObject

- (instancetype)initWithEnvironment:(KBEnvironment *)environment;

- (void)installStatus:(KBInstallActions)completion;

- (void)install:(NSArray *)installables completion:(KBInstallActions)completion;

@end
