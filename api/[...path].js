const handleRequest = require("../animetv-server.js");

module.exports = function animeTvApi(request, response) {
  return handleRequest(request, response);
};
