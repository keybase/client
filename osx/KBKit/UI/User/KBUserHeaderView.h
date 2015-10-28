//
//  KBUserHeaderView.h
//  Keybase
//
//  Created by Gabriel on 1/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>
#import "KBRPC.h"
#import "KBUserImageView.h"

@interface KBUserHeaderView : YOView

@property (readonly) KBUserImageView *imageView;

- (void)setUsername:(NSString *)username;

- (void)setProgressEnabled:(BOOL)progressEnabled;

@end
