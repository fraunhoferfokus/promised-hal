# CHANGELOG
  * `0.3.0`: Better error handling
    * Use HALError to differentiate from common Errors
    * Catch parsing errors when response is not JSON (and reject req)
  * `0.2.1`: Return null instead of throwing error when traversing embeddeds
  * `0.2.0`: Add support for HTTPS
  * `0.1.2`: Fix path building for requests
  * `0.1.1`: Fix error handling for change methods (POST/PUT/PATCH)
  * `0.1.0`: First working draft
