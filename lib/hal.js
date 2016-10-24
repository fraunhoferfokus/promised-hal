'use strict'

const http = require('http')
const url = require('url')

/**
 * Represents a HAL ressource and simplifies its manipulation.
 */
module.exports = class HAL {
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
    this.content = this.content || {}
  }

  /**
   * A simple wrapper around 'http.request' that returns a Promise. The host name
   * is set by default to 'localhost'.
   *
   * @param  {String} method desired HTTP method (defaults to 'GET')
   * @param  {Object} headers desired headers
   * @param  {String} content data body
   * @return {Promise} resolved with an containing body and the actual response
   */
  _request (method, headers, content) {
    return new Promise((resolve, reject) => {
      let body = ''

      let req = http.request({
        auth: this.auth,
        protocol: this.URL.protocol,
        hostname: this.URL.hostname,
        port: this.URL.port || 80,
        path: `${this.URL.path}?${this.URL.query || ''}`,
        method: method,
        headers: headers
      }, res => {
        res.on('data', data => { body += data })
        res.on('end', () => resolve({
          body: JSON.parse(body),
          response: res
        }))
      })

      if ((method === 'POST' || method === 'PUT') && content) req.write(content)
      req.on('error', reject)
      req.end()
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
      let finalResult = {}
      let linkNames = []
      let d = depth || 0

      this._request('GET')
        .then(result => {
          // Save intermidiate results
          finalResult = result.body

          if (depth <= 0) {
            return []
          }

          let links = finalResult['_links']
          // Do not follow links which point to self!
          linkNames = Object.keys(links).filter(linkName => links[linkName].href !== this.URL.href)

          return Promise.all(
            linkNames
              .map(linkName => new HAL(links[linkName].href, this.auth))
              // Fetch that link
              .map(item => item.GET(d - 1))
          )
        })
        .then(embeds => {
          if (embeds.length > 0) {
            finalResult['_embedded'] = finalResult['_embedded'] || {}
          }

          for (let i = 0; i < embeds.length; i++) {
            let name = linkNames[i]
            let item = embeds[i]
            if ('_embedded' in item) {
              item = item['_embedded'][name]
            }

            finalResult['_embedded'][name] = item
          }

          this.content = finalResult
          resolve(this)
        })
        .catch(reject)
    })
  }
}
