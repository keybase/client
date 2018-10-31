//
//  FilesViewController.m
//  KeybaseShare
//
//  Created by John Zila on 10/25/18.
//  Copyright © 2018 Keybase. All rights reserved.
//

#import "FilesViewController.h"
#import "keybase/keybase.h"

@interface FilesViewController ()
@property NSArray* path; // the path we are currently showing
@property NSArray* directoryEntries; // the directory entries at the current path
@end

@implementation FilesViewController

- (void)viewDidLoad {
  [super viewDidLoad];
  
  self.preferredContentSize = CGSizeMake(self.view.frame.size.width, 2*self.view.frame.size.height); // expand
  self.definesPresentationContext = YES;
  
  // show this spinner on top of the table view until we have parsed the inbox
  UIActivityIndicatorView* av = [[UIActivityIndicatorView alloc] initWithActivityIndicatorStyle:UIActivityIndicatorViewStyleGray];
  [self.view addSubview:av];
  [av setTranslatesAutoresizingMaskIntoConstraints:NO];
  [av setHidesWhenStopped:YES];
  [av bringSubviewToFront:self.view];
  [av startAnimating];
  [self.tableView addConstraints:@[
     [NSLayoutConstraint constraintWithItem:av
                                  attribute:NSLayoutAttributeCenterX
                                  relatedBy:NSLayoutRelationEqual
                                     toItem:self.tableView
                                  attribute:NSLayoutAttributeCenterX
                                 multiplier:1 constant:0],
     [NSLayoutConstraint constraintWithItem:av
                                  attribute:NSLayoutAttributeCenterY
                                  relatedBy:NSLayoutRelationEqual
                                     toItem:self.tableView
                                  attribute:NSLayoutAttributeCenterY
                                 multiplier:1 constant:0]
     ]
   ];
  
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    NSError* error = NULL;
    [self setPath:[NSArray new]];
    [self setDirectoryEntries:[NSArray new]];
    NSString* jsonFiles = KeybaseExtensionListPath(@"", &error); // returns the path list in JSON format
    if (jsonFiles == nil) {
      dispatch_async(dispatch_get_main_queue(), ^{
        NSLog(@"failed to get files: %@", error);
        [av stopAnimating];
      });
      // just show blank in this case
      return;
    }
    [self parseFiles:jsonFiles];
    dispatch_async(dispatch_get_main_queue(), ^{
      [av stopAnimating];
      [self.tableView reloadData];
    });
  });
}

- (void)parseFiles:(NSString*)jsonFiles {
  NSError *error = nil;
  NSData *data = [jsonFiles dataUsingEncoding:NSUTF8StringEncoding];
  NSArray *items = [NSJSONSerialization JSONObjectWithData:data options: NSJSONReadingMutableContainers error: &error];
  if (!items) {
    NSLog(@"parseFiles: error parsing JSON: %@", error);
  } else {
    [self setDirectoryEntries:items];
  }
}

- (void)didReceiveMemoryWarning {
  KeybaseExtensionForceGC();
  [super didReceiveMemoryWarning];
}

#pragma mark - Table view data source

- (NSInteger)numberOfSectionsInTableView:(UITableView *)tableView {
    return 1;
}

- (NSInteger)tableView:(UITableView *)tableView numberOfRowsInSection:(NSInteger)section {
    return [self.directoryEntries count];
}

- (NSDictionary*)getItemAtIndex:(NSIndexPath*)indexPath {
  NSInteger index = [indexPath item];
  return self.directoryEntries[index];
}

- (UITableViewCell *)tableView:(UITableView *)tableView cellForRowAtIndexPath:(NSIndexPath *)indexPath {
  UITableViewCell *cell = [tableView dequeueReusableCellWithIdentifier:@"ConvCell"];
  if (NULL == cell) {
    cell = [[UITableViewCell alloc] initWithStyle:UITableViewCellStyleDefault reuseIdentifier:@"ConvCell"];
  }
  NSDictionary* item = [self getItemAtIndex:indexPath];
  [[cell textLabel] setText:item[@"Name"]];
  return cell;
}

- (void)tableView:(UITableView *)tableView didSelectRowAtIndexPath:(NSIndexPath *)indexPath {
  NSDictionary* folder = [self getItemAtIndex:indexPath];
  [self.delegate folderSelected:folder]; // let main view controller know we have something
}

@end
