//
//  KBInstallStatusView.h
//  Keybase
//
//  Created by Gabriel on 5/10/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>


#import <Tikppa/Tikppa.h>
#import "KBRPC.h"
#import "KBInstaller.h"

@interface KBInstallStatusView : YOView

@property KBNavigationView *navigation;
@property KBRPClient *client;

@property (copy) dispatch_block_t completion;

- (void)setEnvironment:(KBEnvironment *)environment;

@end
