//
//  KBUserImageView.m
//  Keybase
//
//  Created by Gabriel on 3/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBUserImageView.h"

#import "AppDelegate.h"

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


@implementation KBImageView (KBUserImageView)

- (void)kb_setUsername:(NSString *)username {
  if (!username) {
    self.image = nil;
    return;
  }
  NSString *URLString = [AppDelegate.appView APIURLString:NSStringWithFormat(@"%@/picture?format=square_200", username)];

  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:URLString]];
  [request addValue:@"image/*" forHTTPHeaderField:@"Accept"];

  GHWeakSelf gself = self;
  [self setImageWithURLRequest:request placeholderImage:nil success:^(NSURLRequest *request, NSHTTPURLResponse *response, NSImage *image) {
    gself.image = image;
  } failure:^(NSURLRequest *request, NSHTTPURLResponse *response, NSError *error) {
    if (response.statusCode == 404) {
      [gself setImageWithURL:[NSURL URLWithString:@"https://keybase.io/images/no_photo.png"]];
    }
  }];
}

@end