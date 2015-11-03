//
//  KBUserImageView.m
//  Keybase
//
//  Created by Gabriel on 3/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBUserImageView.h"
#import "KBWorkspace.h"
#import "KBApp.h"

#import <Tikppa/Tikppa.h>

@implementation KBImageView (KBUserImageView)

- (void)kb_setUsername:(NSString *)username {
  self.image = nil;
  [self setNeedsDisplay];
  if (!username) {
    return;
  }
  NSString *URLString = [KBApp.app APIURLString:NSStringWithFormat(@"%@/picture?format=square_200", username)];

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:URLString]];
  [request addValue:@"image/*" forHTTPHeaderField:@"Accept"];

  GHWeakSelf gself = self;
  [self setImageWithURLRequest:request placeholderImage:nil success:^(NSURLRequest *request, NSHTTPURLResponse *response, NSImage *image) {
    gself.image = image;
    [gself setNeedsDisplay];
  } failure:^(NSURLRequest *request, NSHTTPURLResponse *response, NSError *error) {
    if (response.statusCode == 404) {
      [gself setImageWithURL:[NSURL URLWithString:@"https://keybase.io/images/no_photo.png"]];
    }
  }];
}

@end


@implementation KBUserImageView

- (void)viewInit {
  [super viewInit];
  self.roundedRatio = 1.0;
}

- (void)setUsername:(NSString *)username {
  _username = username;
  [self kb_setUsername:_username];
}

@end
