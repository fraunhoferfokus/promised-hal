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
   * @param {String} auth simple auth (i.e. 'username:password')
   * @param {Object} [content={}] default content of resource
   * @return {HAL} created instance
   */
  constructor (URL, auth, content) {
    this.URL = url.parse(URL)
    this.auth = auth
    this.content = content || {}
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
        auth: this.auth,
        protocol: this.URL.protocol,
        hostname: this.URL.hostname,
        port: this.URL.port || 80,
        path: `${this.URL.path}?${this.URL.query || ''}`,
        method: method,
        headers: Object.assign(HAL.defaultHeaders, headers)
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

      if ((method === 'POST' || method === 'PUT') && this.content) {
        req.write(JSON.stringify(this.content))
      }
      req.on('error', reject)
      req.end()
    })
  }

  /**
   * Core of POST and PUT operations to create/update the resource
   *
   * @param {String} method either PUT or POST
   * @param {Object} [headers] optional request headers
   * @return {Promise} promise resolved with an containing body and the actual response
   */
  _change (method, headers) {
    return new Promise((resolve, reject) => {
      if (['POST', 'PUT'].indexOf(method.toUpperCase()) < 0) {
        return reject(new Error(`Method ${method} is invalid! (only PUT and POST)`))
      }

      this._request(method, headers)
        .then(result => {
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
          .map(linkName => new HAL(links[linkName].href, this.auth))
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
   * Sets or gets a link. If value is provided, this acts
   * as a setter, otherwise as a getter.
   *
   * @param {String} key description
   * @param {String} value description
   * @return {(HAL|Object)} this instance for setter or link
   * value as getter
   */
  link (key, value) {
    // Setter
    if (value !== undefined) {
      this.content['_links'] = Object.assign({
        [key]: value
      }, this.content['_links'] || {})
      return this
    }

    // Getter
    return this.content['_links'][key]
  }

  /**
   * @param {String} key of embedded item
   * @return {Object} embedded item
   */
  embedded (key) {
    return this.content['_embedded'][key]
  }
}
Object.defineProperty(HAL, 'defaultHeaders', {
  enumerable: true,
  value: {
    Accept: 'application/hal+json',
    'Content-Type': 'application/hal+json'
  }
})

module.exports = HAL
