//
//  KBKeyImportView.h
//  Keybase
//
//  Created by Gabriel on 3/16/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>
#import "KBRPC.h"

typedef void (^KBKeyImportCompletion)(id sender, BOOL imported);

@interface KBKeyImportView : YOView

@property KBNavigationView *navigation;
@property KBRPClient *client;

@property (copy) KBKeyImportCompletion completion;

@end
