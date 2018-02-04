# Travis Logs to Papertrail

An [AWS Lambda](https://aws.amazon.com/lambda/) function that, in partnership with the [AWS API Gateway](https://aws.amazon.com/api-gateway/), sends your [Travis CI](https://travis-ci.org/) build logs to [Papertrail](https://papertrailapp.com/) for easy aggregation, search and alerts.

## Why??

Well, partly for fun. But also because I like having [all](https://github.com/tdmalone/sftp-to-papertrail) [my](https://github.com/tdmalone/cloudwatch-to-papertrail) [logs](https://github.com/tdmalone/sns-to-papertrail) aggregated to the same place. It makes it simple and easy to search, view, and be alerted of issues in a familiar interface, and I like the simplicity of Papertrail.

## But still, why build logs??

Builds will fail on a non-zero exit code, and pass on a zero exit code.

But how often have you had builds pass when they shouldn't? Maybe you forgot to catch a rejected Promise, or maybe you piped output to a command that clobbered your exit code. In those instances, you won't notice a build that should have failed unless you happen to check the logs.

But if the logs are aggregated and you have alerts set up on key terms, you can be alerted anyway.

Or perhaps you want to alerted by outputted 'warning' text in your builds, even though a warning usually isn't enough to fail a build.

## Setup

### Lambda

Instructions to come.

### API Gateway

Instructions to come.

### travis.yml

Add the following to your `.travis.yml`:

    notifications:
      webhooks:
        urls: https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com/API_STAGE/API_ENDPOINT

You don't need to change any of the `on_success`/`on_failure` etc. flags from the default, unless you particularly want to only log errors dependent on certain outcomes.

#### A note about `on_start`

The `on_start` setting technically isn't supported by this script yet, as the intention is to retrieve and send your job's logs after it has _completed_. It shouldn't be too hard to expand to cover a live logging scenario beginning at the start, but this will probably mean your Lambda will need to run for the duration of your build. This can both increase your costs, and risk logs being cut off if your job continues longer than your Lambda timeout (the maximum AWS allows is 5 minutes).

### Papertrail Alerts

You'll probably want to set up [Papertrail alerts](https://help.papertrailapp.com/kb/how-it-works/alerts/) to make the most of aggregating your build logs there. Think about what you want to keep an eye out for, then do a search for it. Check your results are what you expect, then you can save the search and set up an alert for it.

You can craft your searches to return only the results you want, and exclude those you don't want.

This is my current setting:

    ( error OR warning ) -'-Werror=format' -'to give useful error messages' -SNIMissingWarning -InsecurePlatformWarning

## Tests

To run all tests at once:

    yarn test

### Unit Tests

To run:

    yarn unit-tests

Unit tests are yet to be written, and will currently just pass.

### Integration Tests

To run:

    yarn docker-tests

Integration tests require [Docker](https://docs.docker.com/install/). They run in `lambci/lambda:nodejs6.10` ([GitHub](https://github.com/lambci/docker-lambda) | [Docker Hub](https://hub.docker.com/r/lambci/lambda/)).

The following environment variables must be defined on your system:

* `PAPERTRAIL_HOST`
* `PAPERTRAIL_PORT`
* `TRAVIS_API_TOKEN`
* `CI` - optional

You can get your Papertrail details from [the bar at the top of this page](https://papertrailapp.com/systems/setup), and your Travis API token from the top left of [your profile](https://travis-ci.org/profile/) (if you're using Travis Pro, make sure you get your token from [your travis-ci.com profile](https://travis-ci.com/profile/)).

The final `CI` variable above is optional, but recommended. If set (which it is [by default on Travis CI](https://docs.travis-ci.com/user/environment-variables/#Default-Environment-Variables), for instance), it will 1) cause errors to be _thrown_ rather than returned as an [API Gateway style response](https://docs.aws.amazon.com/apigateway/latest/developerguide/handle-errors-in-lambda-integration.html), and 2) only log the final line of the test job rather than all 500-odd lines.

## TODO

* Complete the instructions in this file.
* Better error handling for when logs are not available and/or stream cannot be read.
* Add proper support for travis-ci.com (passing access token and pro API option to [the API wrapper](https://www.npmjs.com/package/travis-ci))
* Add unit tests.
* Add webhook verification to ensure it comes from Travis (see [here](https://github.com/Brodan/travis-webhook-verification-nodejs/blob/master/express.js) for an example).

## Acknowledgements

This would have taken a lot longer to put together without [travis-log-stream](https://github.com/juliangruber/travis-log-stream). Thanks [Julian Gruber](https://github.com/juliangruber)!

## License

[MIT](LICENSE).
