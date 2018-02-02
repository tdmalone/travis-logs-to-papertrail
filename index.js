/**
 * Receives webhook notifications from Travis CI (ideally at the end of the build only), retrieves
 * the build logs and sends them to Papertrail.
 *
 * @author Tim Malone <tdmalone@gmail.com>
 */

'use strict';

const logStream = require( 'travis-log-stream' ),
      winston = require( 'winston' ),
      querystring = require( 'querystring' ),
      papertrailTransport = require( 'winston-papertrail' ).Papertrail,
      lambdaProxyResponse = require( '@tdmalone/lambda-proxy-response' );

/* eslint-disable no-process-env */
const PAPERTRAIL_HOST = process.env.PAPERTRAIL_HOST,
      PAPERTRAIL_PORT = process.env.PAPERTRAIL_PORT,
      TRAVIS_API_TOKEN = process.env.TRAVIS_API_TOKEN,
      CI = process.env.CI;
/* eslint-enable no-process-env */

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
        TRAVIS_JOB = payload.id,
        TRAVIS_REPO = payload.repository.name;

  console.log( 'Spinning up...' );

  const log = new winston.Logger({
    transports: []
  });

  log.add( papertrailTransport, {

    host:         PAPERTRAIL_HOST,
    port:         PAPERTRAIL_PORT,
    hostname:     'travis-ci',
    program:      TRAVIS_REPO,
    flushOnClose: true,

    logFormat: ( level, message ) => {
      return message;
    }

  });

  const travis = logStream({
    jobId:  TRAVIS_JOB,
    appKey: TRAVIS_API_TOKEN
  });

  let loggedLines = 0;

  travis.on( 'readable', () => {

    const data = travis.read();

    if ( ! data ) {
      log.close();
      lambdaProxyResponse( null, 'Logged ' + loggedLines + ' lines to Papertrail.', callback );
      return;
    }

    let dataString = data.toString();

    // If testing, log the last line only.
    if ( CI ) {
      dataString = dataString.trim().split( '\n' ).pop();
    }

    log.info( dataString );
    loggedLines += dataString.split( '\n' ).length;

  }); // Travis readable.
}; // Exports.handler.

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
