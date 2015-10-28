//
//  KBPGPSignFilesView.h
//  Keybase
//
//  Created by Gabriel on 5/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>
#import "KBRPC.h"

@interface KBPGPSignFilesView : YOView

@property KBNavigationView *navigation;
@property KBRPClient *client;

@end
