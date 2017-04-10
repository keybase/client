//
//  KBFoldersAppView.h
//  Keybase
//
//  Created by Gabriel on 3/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>
#import "KBRPC.h"

@interface KBFoldersAppView : YOView

@property KBNavigationView *navigation;
@property (nonatomic) KBRPClient *client;

- (void)reload;

@end
