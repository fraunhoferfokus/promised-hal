'use strict'

/**
 * An error class for all errors during communication
 * with a HAL server.
 *
 * @class HALError
 */
class HALError extends Error {
  /**
   * Constructs.
   *
   * @param {string} [message=HAL Error] error message
   * @param {number} [code=0] error code
   * @see HALError.ERROR_CODES
   */
  constructor (message, code) {
    super(message || 'HAL Error')
    this.code = code || HALError.ERROR_CODES.GENERAL

    Error.captureStackTrace(this, HALError)
  }
}
Object.defineProperty(HALError, 'ERROR_CODES', {
  enumerable: true,
  writable: false,
  value: {
    GENERAL: 0,
    RESPONSE: 10,
    REQUEST: 11
  }
})

module.exports = HALError
