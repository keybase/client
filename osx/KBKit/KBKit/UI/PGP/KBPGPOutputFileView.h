//
//  KBPGPOutputFileView.h
//  Keybase
//
//  Created by Gabriel on 3/27/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>
#import "KBRPC.h"

@interface KBPGPOutputFileView : YOView

@property KBNavigationView *navigation;
@property KBRPClient *client;

- (void)setFiles:(NSArray *)files;

@end
