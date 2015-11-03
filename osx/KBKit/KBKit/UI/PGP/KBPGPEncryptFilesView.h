//
//  KBPGPEncryptFilesView.h
//  Keybase
//
//  Created by Gabriel on 3/23/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>
#import "KBRPC.h"
#import "KBFile.h"

@interface KBPGPEncryptFilesView : YOView

@property KBNavigationView *navigation;
@property (nonatomic) KBRPClient *client;

- (void)addFile:(KBFile *)file;

@end
