//
//  KBFolderAddView.h
//  Keybase
//
//  Created by Gabriel on 7/20/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>
#import "KBRPClient.h"

typedef void (^KBFolderAddViewCompletion)(NSArray *usernames);

@interface KBFolderAddView : YOView

@property (nonatomic) KBRPClient *client;
@property (copy) KBOnTarget close;
@property (copy) KBFolderAddViewCompletion completion;

@end
