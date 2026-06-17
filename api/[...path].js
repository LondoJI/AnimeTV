try {
  require("sharp");
} catch {
  // Optional image optimization still falls back to passthrough locally.
}

const handleRequest = require("../animetv-server.js");

module.exports = function animeTvApi(request, response) {
  return handleRequest(request, response);
};
