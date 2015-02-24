#import <Foundation/Foundation.h>

#import "GRUnit.h"
#import "GRTestApp.h"

int main(int argc, char *argv[]) {
  @autoreleasepool {
    int retVal = 0;
    // If GHUNIT_CLI is set we are using the command line interface and run the tests
    // Otherwise load the GUI app
    if (getenv("GHUNIT_CLI")) {
      GRTestRunner *runner = [GRTestRunner runnerFromEnv];
      [runner run:^(id<GRTest> test){}];
    } else {
      // To run all tests (from ENV)
      [[GRTestApp alloc] init];
      // To run a different test suite:
      //GRTestSuite *suite = [GRTestSuite suiteWithTestFilter:@"GHSlowTest,GHAsyncTestCaseTest"];
      //GRTestApp *app = [[GRTestApp alloc] initWithSuite:suite];
      // Or set global:
      //GHUnitTest = @"GHSlowTest";
      [NSApp run];
    }
    return retVal;
  }
}