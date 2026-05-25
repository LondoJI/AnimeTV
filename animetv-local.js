const { startLocalServer, handleRequest } = require("./animetv-server.js");

if (require.main === module) {
  startLocalServer();
}

module.exports = handleRequest;
