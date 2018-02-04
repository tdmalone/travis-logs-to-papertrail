/**
 * Receives webhook notifications from Travis CI (ideally at the end of the build only), retrieves
 * the logs for each job in the build, and sends them to Papertrail.
 *
 * @author Tim Malone <tdmalone@gmail.com>
 */

'use strict';

const winston = require( 'winston' ),
      travisCi = require( 'travis-ci' ),
      querystring = require( 'querystring' ),
      logStream = require( 'travis-log-stream' ),
      papertrailTransport = require( 'winston-papertrail' ).Papertrail,
      lambdaProxyResponse = require( '@tdmalone/lambda-proxy-response' );

/* eslint-disable no-process-env */
const PAPERTRAIL_HOST = process.env.PAPERTRAIL_HOST,
      PAPERTRAIL_PORT = process.env.PAPERTRAIL_PORT,
      TRAVIS_API_TOKEN = process.env.TRAVIS_API_TOKEN,
      CI = process.env.CI;
/* eslint-enable no-process-env */

const logger = new winston.Logger({
  transports: []
});

const travis = new travisCi({
  version: '2.0.0'
});

exports.handler = ( event, context, callback ) => {

  const body = querystring.parse( event.body );

  // Verify environment and inputs.
  const error = verifyInputs( body );
  if ( error ) {
    lambdaProxyResponse( error, null, callback );
    return;
  }

  // @see https://docs.travis-ci.com/user/notifications/#Webhooks-Delivery-Format
  const payload = JSON.parse( body.payload ),
        TRAVIS_BUILD = payload.id,
        TRAVIS_REPO = payload.repository.name;

  console.log( 'Spinning up...' );

  logger.add( papertrailTransport, {

    host:         PAPERTRAIL_HOST,
    port:         PAPERTRAIL_PORT,
    hostname:     'travis-ci',
    program:      TRAVIS_REPO,
    flushOnClose: true,

    logFormat: ( level, message ) => {
      return message;
    }

  });

  // Get each job in the build.
  // @see https://github.com/pwmckenna/node-travis-ci
  travis.builds( TRAVIS_BUILD ).get( ( error, response ) => {

    if ( error ) {
      lambdaProxyResponse( error, null, callback );
      return;
    }

    const jobs = [];

    // Send the logs for each job to Papertrail.
    response.jobs.forEach( ( job ) => {
      jobs.push( logJob( job.id ) );
    });

    // Finish up once we're done, sending back the results.
    Promise.all( jobs ).then( ( lineCounts ) => {
      const loggedLines = lineCounts.reduce( ( a, b ) => a + b, 0 );
      lambdaProxyResponse( null, 'Logged ' + jobs.length + ' jobs and ' + loggedLines + ' lines to Papertrail.', callback );
    }).catch( ( error ) => {
      lambdaProxyResponse( error, null, callback );
    });

  }); // Travis.builds.get.
}; // Exports.handler.

/**
 * Sends the logs for a single job to Papertrail.
 *
 * @param int jobId The Travis CI job ID. Build IDs are not supported; multiple jobs make up a
 *                  build.
 * @return Promise A promise to retrieve and send the job's logs to Papertrail.
 */
function logJob( jobId ) {
  return new Promise( ( resolve, reject ) => {

    const jobLog = logStream({
      jobId:  jobId,
      appKey: TRAVIS_API_TOKEN
    });

    let loggedLines = 0;

    console.log( 'Logging job ' + jobId + '...' );

    jobLog.on( 'readable', () => {

      const data = jobLog.read();

      if ( ! data ) {
        logger.close();
        resolve( loggedLines );
        return;
      }

      let dataString = data.toString();

      // If testing, log the last line only.
      if ( CI ) {
        dataString = dataString.trim().split( '\n' ).pop();
      }

      logger.info( dataString );
      loggedLines += dataString.split( '\n' ).length;

    }); // Travis readable.
  }); // Return new Promise.
} // Function logJob.

/**
 * Verifies the inputs required to run the main function - both from environment variables and
 * the incoming payload.
 *
 * @param {object} event The incoming API Gateway Lambda proxy payload. Should contain at least
 *                       a `body` property.
 * @return {string|Error|null} An error message if an error occurred, or null if no error.
 */
function verifyInputs( body ) {

  if ( ! PAPERTRAIL_HOST || ! PAPERTRAIL_PORT || ! TRAVIS_API_TOKEN ) {
    return 'Missing PAPERTRAIL_HOST, PAPERTRAIL_PORT or TRAVIS_API_TOKEN.';
  }

  if ( ! body || ! body.payload ) {
    return 'Invalid payload: missing or empty body or payload parameter.';
  }

  let payload;

  try {
    payload = JSON.parse( body.payload );
  } catch ( error ) {
    return error;
  }

  if ( ! payload.id || ! payload.repository || ! payload.repository.name ) {
    return 'Invalid payload: missing job ID or repository name.';
  }

  return null;

} // Function verifyInputs.
