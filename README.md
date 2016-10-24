# Promised HAL
This project provides means of creating and manipulating documents in [Hypertext
Application Language](http://stateless.co/hal_specification.html) or simply HAL.
Moreover it has a number of convenient methods to communicate with HAL enabled
servers in an asynchronous manner using [Promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise).

## Quick start
```js
const HAL = require('promised-hal')

// Fetch a user
let user = new HAL('https://my.api/user/1').auth('basic:auth')
user.GET()
  .then(result => console.log(result))
  .catch(err => console.error(err))

// Update that user
user.content({name: 'Yan Foto'})
  .PUT()
  .then(updated => console.log(updated))
  .catch(err => console.error(err))
```

## Where to use it?
HAL is not a protocol and so the business logic programmed in this module does
not apply to all servers talking HAL. This module was born to ease the pain of
communicating with [Spring Data REST](http://projects.spring.io/spring-data-rest/)
framework. If you are using any other framework on your backend that follows a
similar logic, you are probably good to go!

## API
#### `constructor(url)`
Creates an empty instance of HAL class with `url` pointing to resource location.
See quick start for an example.

#### `atuh(credentials)`
Saves basic HTTP auth for all following requests. `credentials` is a string in
`user:pass` format. Currently only basic authentication is supported. See quick
start for an example.

#### `body(body)`
Attaches a body to the instance, which is passed along `PUT`, `POST`, and `PATCH`
requests. For example, the following can be used to create a `comment`:

```js
let comment = new HAL('https://my.api/comments').body({content: '6 afraid of 8?'})
comment.POST()
  .then(result => console.log('Created resource', result))
  .catch(err => console.error(err))
```

#### `GET(depth)`
Fetches a resources using an HTTP GET request. If depth is given, the module tries
to recursively fetch all resources listed under `_links` and add them under
`_embedded`. Default value for depth if `0`, where no linked resources are fetched.

This method returns a promise which is resolved with the same instance with its
contents updated to the fetched object after the request succeeds. See quick
start for an example.

#### `POST(headers)`
Creates a resource using an HTTP POST request and the content provided by `body()`
method. Additional headers can be provided.

This method returns a promise which is resolved with the same instance with its
contents updated to the server response after the request succeeds. See quick
start for an example.

#### `PUT(headers)`
Updates a resource using an HTTP PUT request and the content provided by `body()`.
See `POST(headers)`.

#### `PATCH(headers)`
Updates a resource using an HTTP PATCH request and the content provided by `body()`.
See `POST(headers)`.

#### `DELETE(headers)`
Sends an HTTP DELETE request to resources URL and returns a promise which is
resolved to the same instance. Optional request headers can also be provided.

```js
let badComment = new HAL('https://my.api/comment/13')
badComment.DELETE()
  .then(result => console.log(result))
  .catch(err => console.error(err))
```
