'use strict'

const http = require('http')
const url = require('url')

/**
 * Represents a HAL ressource and simplifies its manipulation.
 */
class HAL {
  /**
   * Constructs.
   *
   * @param {(String|Url)} URL of HAL resource
   * @param {Object} [content={}] default content of resource
   * @return {HAL} created instance
   */
  constructor (URL, content) {
    this.URL = url.parse(URL)
    this.content = {}
  }

  /**
   * @param {String} credentials in basic auth 'USER:PASS' format
   * @return {HAL} instance
   */
  auth (credentials) {
    this.credentials = credentials
    return this
  }

  /**
   * @param {Object} body instance body
   * @return {HAL} instance
   */
  body (body) {
    this.content = body
    return this
  }

  /**
   * A simple wrapper around 'http.request' that returns a Promise. The host name
   * is set by default to 'localhost'.
   *
   * @param  {String} method desired HTTP method (defaults to 'GET')
   * @param  {Object} headers desired headers
   * @return {Promise} promise resolved with an containing body and the actual response
   */
  _request (method, headers) {
    return new Promise((resolve, reject) => {
      let body = ''

      let req = http.request({
        auth: this.credentials,
        protocol: this.URL.protocol,
        hostname: this.URL.hostname,
        port: this.URL.port || 80,
        path: this.URL.path,
        method: method,
        headers: Object.assign(HAL.DEFAULTHEADERS, headers)
      }, res => {
        res.on('data', data => { body += data })
        res.on('end', () => {
          this.content = (body === '') ? {} : JSON.parse(body)
          resolve({
            body: this.content,
            response: res
          })
        })
      })

      if ((HAL.MODMETHODS.indexOf(method) >= 0) && this.content) {
        req.write(JSON.stringify(this.content))
      }
      req.on('error', reject)
      req.end()
    })
  }

  /**
   * Core of POST and PUT operations to create/update the resource
   *
   * @param {String} method either PUT, PATCH or POST
   * @param {Object} [headers] optional request headers
   * @return {Promise} promise resolved with an containing body and the actual response
   */
  _change (method, headers) {
    return new Promise((resolve, reject) => {
      if (HAL.MODMETHODS.indexOf(method.toUpperCase()) < 0) {
        return reject(new Error(`Method ${method} is invalid! (only PUT and POST)`))
      }

      this._request(method, headers)
        .then(result => {
          let statusCode = result.response.statusCode
          if (statusCode >= 400) {
            return reject(new Error(`Server not succeeded! (error ${statusCode})`))
          }

          this.content = Object.assign(result.body, this.content)
          this.URL = url.parse(this.link('self').href)
          resolve(this)
        }).catch(reject)
    })
  }

  /**
   * Fetches the links and them as embedded resources.
   *
   * @param {Number} [depth=-1] recursion depth
   * @return {Promise} promise resolved when all links are fetched
   */
  _fetchEmbeddeds (depth) {
    return new Promise((resolve, reject) => {
      let d = depth || -1
      let linkNames = []

      let links = this.content['_links']
      // Do not follow links which point to self!
      linkNames = Object.keys(links).filter(linkName => links[linkName].href !== this.URL.href)

      Promise.all(
        linkNames
          .map(linkName => new HAL(links[linkName].href).auth(this.credentials))
          // Fetch that link
          .map(item => item.GET(d - 1))
      ).then(result => {
        let final = {}
        for (let i = 0; i < linkNames.length; i++) {
          final[linkNames[i]] = result[i].content
        }
        resolve(final)
      }).catch(reject)
    })
  }

  /**
   * Fetches a HAL resource and embeds its links recursively.
   * NOTE: to avoid circular references it is not recommended to have a
   * value higher than 0 for depth!
   *
   * @param  {Number} [depth=0] denotes levels of recursion (-1 for none)
   * @return {HAL} self instance with its content field filled
   */
  GET (depth) {
    return new Promise((resolve, reject) => {
      let d = depth || 0

      this._request('GET')
        .then(result => {
          // Save intermidiate results
          this.content = result.body

          if (d <= 0) {
            return null
          }

          return this._fetchEmbeddeds(d - 1)
        })
        .then(embeds => {
          if (embeds !== null) {
            this.content['_embedded'] = embeds
          }
          resolve(this)
        })
        .catch(reject)
    })
  }

  /**
   * Creates a new ressource from this instance
   *
   * @param {Object} [headers] optional headers
   * @return {Promise} promise resolves to this instance if succeeds
   */
  POST (headers) {
    return this._change('POST', headers)
  }

  /**
   * Updates the ressource
   *
   * @param {Object} [headers] optional headers
   * @return {Promise} promise resolves to this instance if succeeds
   */
  PUT (headers) {
    return this._change('PUT', headers)
  }

  /**
   * Patches the ressource
   *
   * @param {Object} [headers] optional headers
   * @return {Promise} promise resolves to this instance if succeeds
   */
  PATCH (headers) {
    return this._change('PATCH', headers)
  }

  /**
   * Deletes the resource
   *
   * @param {Object} [headers] optional headers
   * @return {Promise} promise resolving to this instance if succeeds
   */
  DELETE (headers) {
    return new Promise((resolve, reject) => {
      this._request('DELETE')
        .then(() => resolve(this))
        .catch(reject)
    })
  }

  /**
   * @param {String} key desired link name
   * @return {Object} link's value
   */
  link (key) {
    return this.content['_links'][key]
  }

  /**
   * Follows a link by name
   *
   * @param {String} link desired link
   * @param {int} [depth=0] embedded recursion link (as in #GET)
   * @return {Promise} promise resolved with instance of fetched link
   */
  follow (link, depth) {
    return new Promise((resolve, reject) => {
      let linkObject = this.link(link)
      if (!linkObject) return reject(new Error(`Link ${link} does not exist!`))

      this.URL = url.parse(linkObject.href)
      this.GET(depth).then(resolve).catch(reject)
    })
  }

  /**
   * Associates this resource with given resource URL as given
   * resource name.
   *
   * NOTE: this method works properly with Spring data REST backends
   * and might not work properly with other backends.
   *
   * @param {String} resourceName desired resource name to associate
   * @param {String} resourceUrl localtion of resource to be associated
   * @return {Promise} promise resolved with instance of this resource
   */
  associate (resourceName, resourceUrl) {
    return this.body({[resourceName]: resourceUrl}).PATCH()
  }

  /**
   * Deep value retrieval from embedded items.
   *
   * The key is in dot notation, e.g. 'statuses.2.numericValue' would look
   * under embedded sensors, the second item, and finally its numericValue field.
   *
   * @param {String} key of embedded item (in dot notation)
   * @return {Object} embedded item
   */
  embedded (key) {
    return key
      .split('.')
      .map(item => parseInt(item, 10) || item)
      .reduce((prev, cur) => prev[cur], this.content['_embedded'])
  }
}
// Default headers passed along each request
Object.defineProperty(HAL, 'DEFAULTHEADERS', {
  enumerable: true,
  value: {
    Accept: 'application/hal+json',
    'Content-Type': 'application/hal+json'
  }
})
// List of HTTP methods which are meant for data modification
// These methods have the same logic in background
Object.defineProperty(HAL, 'MODMETHODS', {
  enumerable: false,
  value: ['POST', 'PUT', 'PATCH']
})

module.exports = HAL
