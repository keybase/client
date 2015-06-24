//
//  KBInstallerView.h
//  Keybase
//
//  Created by Gabriel on 5/10/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>


#import <KBAppKit/KBAppKit.h>
#import "KBRPC.h"
#import "KBInstaller.h"

@interface KBInstallerView : YOView

@property KBNavigationView *navigation;
@property KBRPClient *client;

@property (nonatomic) KBInstaller *installer;
@property (copy) dispatch_block_t completion;

@end
