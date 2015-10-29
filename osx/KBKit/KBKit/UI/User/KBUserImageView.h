//
//  KBUserImageView.h
//  Keybase
//
//  Created by Gabriel on 3/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>

@interface KBImageView (KBUserImageView)

- (void)kb_setUsername:(NSString *)username;

@end

@interface KBUserImageView : KBImageView

@property (nonatomic) NSString *username;

@end
